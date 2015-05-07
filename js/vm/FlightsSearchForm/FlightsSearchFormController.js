'use strict';
define(
	['knockout', 'js/vm/helpers', 'js/vm/BaseControllerModel'],
	function (ko, helpers, BaseControllerModel) {
		function FlightsSearchFormController (componentParameters) {
			BaseControllerModel.apply(this, arguments);

			this.serviceClasses = ['All', 'Economy', 'Business', 'First'];
			this.tripTypes = ['OW','RT','CR'];

			this.segments = ko.observableArray([]);
			this.dateRestrictions = [];
			this.passengers = ko.observable({});
			this.options = {};

			this.tripType = ko.observable('OW');
			this.directFlights = ko.observable(false);
			this.vicinityDates = ko.observable(false);
			this.serviceClass = ko.observable(this.serviceClasses[0]);

			this.validaTERROR = ko.observable(false);

			this.mode = 'normal'; // tunesearch preinitted cookied
			this.tuneSearch = 0;
			this.preinittedData = {
				segments: [],
				passengers: {},
				serviceClass: this.serviceClass(),
				direct: false,
				vicinityDates: false,
				immediateSearch: false
			};

			this.typeSelectorOpen       = ko.observable(false);
			this.classSelectorOpen      = ko.observable(false);
			this.passengersSelectorOpen = ko.observable(false);

			this.toggleTypeSelector       = function () {this.typeSelectorOpen(!this.typeSelectorOpen());};
			this.toggleClassSelector      = function () {this.classSelectorOpen(!this.classSelectorOpen());};
			this.togglePassengersSelector = function () {this.passengersSelectorOpen(!this.passengersSelectorOpen());};

			this.processInitParams();

			this.segments.subscribe(function (newValue) {
				this.recalcDateRestrictions();
			},this);

			this.tripType.subscribe(function (newValue) {
				var segments = this.segments();

				this.$$controller.log('TripType set to', newValue);

				switch (newValue) {
					case 'OW':
						this.segments.splice(1);
						break;

					case 'RT':
						var tmpdate = null;

						// We process segments only if current segments don't look like an RT
						if (
							// Segments count != 2
							segments.length != 2 ||
							// First segment departure and no second arrival
							(segments[0].items.departure.value() && !segments[1].items.arrival.value()) ||
							// First segment arrival and no second departure
							(segments[0].items.arrival.value() && !segments[1].items.departure.value()) ||
							// Second segment departure and no first arrival
							(segments[1].items.departure.value() && !segments[0].items.arrival.value()) ||
							// Second segment arrival and no first departure
							(segments[1].items.arrival.value() && !segments[0].items.departure.value()) ||
							// Departure and arrival mismatch
							(segments[0].items.departure.value() && segments[0].items.departure.value().identifier != segments[1].items.arrival.value().identifier) ||
							(segments[1].items.departure.value() && segments[1].items.departure.value().identifier != segments[0].items.arrival.value().identifier)
						) {
							if (segments.length >= 2) {
								tmpdate = segments[1].items.departureDate.value();
							}

							if (segments.length > 1) {
								this.segments.splice(1);
							}

							this.addSegment(this.segments()[0].items.arrival.value(), this.segments()[0].items.departure.value(), tmpdate);
						}

						break;

					case 'CR':
						break;
				}
			}, this);

			this.passengersSummary = ko.computed(function () {
				var ret = '',
					total = 0,
					passengers = this.passengers(),
					passTypes = [];

				for (var i in passengers) {
					if (passengers.hasOwnProperty(i)) {
						var t = passengers[i]();
						if (t > 0) {
							total += t;
							passTypes.push(i);
						}
					}
				}

				if (passTypes.length == 0) {
					ret = this.$$controller.i18n('FlightsSearchForm','passSummary_numeral_noPassengers');
				}
				else if (passTypes.length == 1) {
					ret = total + ' ' + this.$$controller.i18n('FlightsSearchForm','passSummary_numeral_' + passTypes.pop() + '_' + helpers.getNumeral(total, 'one', 'twoToFour', 'fourPlus'));
				}
				else {
					ret = total + ' ' + this.$$controller.i18n('FlightsSearchForm','passSummary_numeral_mixed_' + helpers.getNumeral(total, 'one', 'twoToFour', 'fourPlus'));
				}

				return ret;
			}, this);

			this.passengersRestrictions = ko.computed(function () {
				var ret = {},
					passengers = this.passengers(),
					adtSum = 0,
					infSum = 0,
					total = 0;

				for (var i in passengers) {
					if (passengers.hasOwnProperty(i)) {
						ret[i] = {min: 0, max: 0};

						total += passengers[i]();

						if (this.passengerAdultTypes.indexOf(i) >= 0) {
							adtSum += passengers[i]();
						}

						if (this.passengerInfantTypes.indexOf(i) >= 0) {
							infSum += passengers[i]();
						}
					}
				}

				// Setting maximums regarding maximum passenger count
				for (var i in ret) {
					if (ret.hasOwnProperty(i)) {
						ret[i].max = Math.min(passengers[i]() + this.options.totalPassengers - total, parseInt(this.options.passengerCount[i]));
					}
				}

				// ADT+YTH+SRC >= INF+INS
				// Infants: not more than adtSum
				for (var i = 0; i < this.passengerInfantTypes.length; i++) {
					if (ret.hasOwnProperty(this.passengerInfantTypes[i])) {
						ret[this.passengerInfantTypes[i]].max = Math.min(adtSum, ret[this.passengerInfantTypes[i]].max);
					}
				}

				// Adults: not less than infSum
				for (var i = 0; i < this.passengerAdultTypes.length; i++) {
					if (ret.hasOwnProperty(this.passengerAdultTypes[i])) {
						ret[this.passengerAdultTypes[i]].min = Math.max(
							0,
							passengers[this.passengerAdultTypes[i]]() - adtSum + infSum,
							ret[this.passengerAdultTypes[i]].min
						);
					}
				}

				return ret;
			}, this);

			this.isValid = ko.computed(function () {
				var segments = this.segments(),
					ret = true,
					prevDate;

				if (segments.length) {
					for (var i = 0; i < segments.length; i++) {
						if (segments[i].items.departureDate.value()) {
							if (prevDate && segments[i].items.departureDate.value().dateObject() < prevDate) {
								segments[i].items.departureDate.error('notInOrder');
								ret = false;
							}
							else if (i + 1 == segments.length && segments[i].items.departureDate.value().dateObject() > this.options.dateOptions.maxDate) {
								segments[i].items.departureDate.error('tooLate');
								ret = false;
							}
							else if (i == 0 && segments[i].items.departureDate.value().dateObject() < this.options.dateOptions.minDate) {
								segments[i].items.departureDate.error('tooEraly');
								ret = false;
							}
							else {
								segments[i].items.departureDate.error(null);
							}

							prevDate = segments[i].items.departureDate.value().dateObject();
						}

						for (var j in segments[i].items) {
							if (segments[i].items.hasOwnProperty(j) && segments[i].items[j].error()) {
								ret = false;
							}
						}
					}
				}

				return ret;
			}, this);
		}

		// Extending from dictionaryModel
		helpers.extendModel(FlightsSearchFormController, [BaseControllerModel]);

		// Inheritance override
		FlightsSearchFormController.prototype.passengerTypesOrder  = ['ADT', 'CLD', 'INF', 'INS', 'YTH', 'SRC'];
		FlightsSearchFormController.prototype.passengerAdultTypes  = ['ADT', 'YTH', 'SRC'];
		FlightsSearchFormController.prototype.passengerInfantTypes = ['INF', 'INS'];
		FlightsSearchFormController.prototype.$$i18nSegments       = ['FlightsSearchForm'];
		FlightsSearchFormController.prototype.$$KOBindings         = ['FlightsSearchForm'];

		// Additional stuff
		// RegExps for params parsing
		FlightsSearchFormController.prototype.paramsParsers = {
			segs: /([A-Z]{3})([A-Z]{3})(\d{8})/g,
			passengers: /([A-Z]{3})(\d+)/g
		};

		FlightsSearchFormController.prototype.processInitParams = function () {
			// Analyzing parameters
			// Tunesearch
			if (this.$$componentParameters.length == 1) {
				this.tuneSearch = parseInt(this.$$componentParameters[0]);

				if (!isNaN(this.tuneSearch)) {
					this.mode = 'tunesearch';
				}
			}
			// Preinitted by URL
			else if (this.$$componentParameters.length == 3) {
				var t;

				// Parsing segments
				while (t = this.paramsParsers.segs.exec(this.$$componentParameters[0])) {
					t.shift();

					// Processing date
					t[2] = t[2].substr(0,4) + '-' + t[2].substr(4,2) + '-' + t[2].substr(6);

					// If we're preinitted by URL - IATAS mean cities first
					t.push(true);
					t.push(true);

					this.preinittedData.segments.push(t);
				}

				// Parsing passengers
				while (t = this.paramsParsers.passengers.exec(this.$$componentParameters[1])) {
					this.preinittedData.passengers[t[1]] = parseInt(t[2]);
				}

				this.mode = 'preinitted';

				// Other params
				if (this.$$componentParameters[2]) {
					this.$$componentParameters[2] = this.$$componentParameters[2].split('-');

					for (var i = 0; i < this.$$componentParameters[2].length; i++) {
						// Direct flights flag
						if (this.$$componentParameters[2][i] == 'direct') {
							this.preinittedData.direct = true;
						}

						// Vicinity dates flag
						if (this.$$componentParameters[2][i] == 'vicinityDates') {
							this.preinittedData.vicinityDates = true;
						}

						// Immediate search start
						if (this.$$componentParameters[2][i] == 'GO') {
							this.preinittedData.immediateSearch = true;
						}

						// Class
						if (this.$$componentParameters[2][i].substr(0, 6) == 'class=') {
							t = this.$$componentParameters[2][i].substr(6);

							if (this.serviceClasses.indexOf(t) >= 0) {
								this.preinittedData.serviceClass = t;
							}
						}
					}
				}
			}
			// TODO Preinitted by cookie
		};

		FlightsSearchFormController.prototype.recalcDateRestrictions = function () {
			var segments = this.segments(),
				prevdate,
				nextdate;

			this.dateRestrictions = [];

			for (var i = 0; i < segments.length; i++) {
				prevdate = this.options.dateOptions.minDate;
				nextdate = null;

				for (var j = 0; j < segments.length; j++) {
					if (j < i && segments[j].items.departureDate.value()) {
						if (!prevdate || prevdate < segments[j].items.departureDate.value().dateObject()) {
							prevdate = segments[j].items.departureDate.value().dateObject();
						}
					}
					else if (j > i && segments[j].items.departureDate.value() && !nextdate) {
						nextdate = segments[j].items.departureDate.value().dateObject();
					}
				}

				if (!nextdate || prevdate > nextdate) {
					nextdate = this.options.dateOptions.maxDate;
				}

				this.dateRestrictions.push([prevdate, nextdate]);
			}
		};

		FlightsSearchFormController.prototype.getSegmentDateParameters = function (dateObj, index) {
			var ret = {
					disabled: this.dateRestrictions[index][0] > dateObj || this.dateRestrictions[index][1] < dateObj,
					segments: []
				},
				segments = this.segments();

			for (var i = 0; i < segments.length; i++) {
				if (segments[i].items.departureDate.value() && dateObj.getTime() == segments[i].items.departureDate.value().dateObject().getTime()) {
					ret.segments.push(i);
				}
			}

			return ret;
		};

		FlightsSearchFormController.prototype.segmentGeoChanged = function (segment, geo) {
			if (this.tripType() == 'RT' && segment.index == 0) {
				var targetSeg = this.segments()[1];

				targetSeg.items[geo == 'arrival' ? 'departure' : 'arrival'].value(segment.items[geo].value());
			}
		};

		FlightsSearchFormController.prototype.processValidation = function () {
			var segments;

			if (this.validaTERROR()) {
				segments = this.segments();

				for (var i = 0; i < segments.length; i++) {
					for (var j in segments[i].items) {
						if (
							segments[i].items.hasOwnProperty(j) &&
							segments[i].items[j].error()
						) {
							segments[i].items[j].focus(true);
							return;
						}
					}
				}
			}
		};

		FlightsSearchFormController.prototype.startSearch = function () {
			if (!this.isValid()) {
				this.validaTERROR(true);
				this.processValidation();
			}
			else {
				this.$$controller.warn('STARTING SEARCH');
			}
		};

		FlightsSearchFormController.prototype.setPassengers = function (type, count) {
			var restrictions = this.passengersRestrictions();

			if (restrictions[type] && count >= restrictions[type].min && count <= restrictions[type].max) {
				this.passengers()[type](count);
			}
		};

		FlightsSearchFormController.prototype.getPassengersCounts = function (passType) {
			var ret = [];

			// From 0 to maximum count including
			for (var i = 0; i <= this.options.passengerCount[passType]; i++) {
				ret.push(i);
			}

			if (passType == 'ADT') {
				ret.shift();
			}

			return ret;
		};

		FlightsSearchFormController.prototype.fillPreInittedPassengers = function (typesList) {
			var tmp;

			for (var i = 0; i < typesList.length; i++) {
				tmp = this.passengersRestrictions()[typesList[i]];
				if (tmp && this.preinittedData.passengers[typesList[i]]) {
					if (this.preinittedData.passengers[typesList[i]] > tmp.max) {
						this.preinittedData.passengers[typesList[i]] = tmp.max;
					}
					else if (this.preinittedData.passengers[typesList[i]] < tmp.min) {
						this.preinittedData.passengers[typesList[i]] = tmp.min;
					}

					this.setPassengers(typesList[i], this.preinittedData.passengers[typesList[i]]);
				}
			}
		};

		FlightsSearchFormController.prototype.buildModels = function () {
			var geo = {
					cities: {},
					countries: {},
					airports: {}
				},
				tmpass = {},
				today = new Date();

			// Checking for errors
			if (this.$$rawdata.system && this.$$rawdata.system.error) {
				this.$$error(this.$$rawdata.system.error.message);
				return;
			}

			// Processing options
			// Passengers maximums
			this.options = this.$$rawdata.flights.search.formData.maxLimits;
			this.options.totalPassengers = parseInt(this.options.totalPassengers);

			// Date options
			this.options.dateOptions = this.$$rawdata.flights.search.formData.dateOptions;
			today.setHours(0,0,0,0);
			this.options.dateOptions.minDate = new Date(today);
			this.options.dateOptions.minDate.setDate(this.options.dateOptions.minDate.getDate() + this.options.dateOptions.minOffset);
			this.options.dateOptions.maxDate = new Date(today);
			this.options.dateOptions.maxDate.setDate(this.options.dateOptions.maxDate.getDate() + this.options.dateOptions.maxOffset);

			// Processing passengers counts
			for (var i = 0; i < this.$$rawdata.flights.search.request.passengers.length; i++) {
				tmpass[this.$$rawdata.flights.search.request.passengers[i].type] = this.$$rawdata.flights.search.request.passengers[i].count;
			}

			// Processing segments
			if (this.mode == 'preinitted') {
				var tmp;

				for (var i = 0; i < this.preinittedData.segments.length; i++) {
					var depdata = {
							IATA: this.preinittedData.segments[i][0],
							isCity: this.preinittedData.segments[i][3],
							cityID: 0
						},
						arrdata = {
							IATA: this.preinittedData.segments[i][1],
							isCity: this.preinittedData.segments[i][4],
							cityID: 0
						};

					this.addSegment(
						this.$$controller.getModel('FlightsSearchForm/FlightsSearchFormGeo', {data: depdata, guide: this.$$rawdata.guide}),
						this.$$controller.getModel('FlightsSearchForm/FlightsSearchFormGeo', {data: arrdata, guide: this.$$rawdata.guide}),
						this.$$controller.getModel('common/FlightsSearchFormDate', this.preinittedData.segments[i][2])
					);
				}

				// Detecting tripType
				if (this.preinittedData.segments.length == 1) {
					this.tripType('OW');
				}
				else if (
					this.preinittedData.segments.length == 2 &&
					this.preinittedData.segments[0][0] == this.preinittedData.segments[1][1] &&
					this.preinittedData.segments[0][1] == this.preinittedData.segments[1][0]
				) {
					this.tripType('RT');
				}
				else {
					this.tripType('CR');
				}

				// Setting other options
				this.directFlights(this.preinittedData.direct);
				this.vicinityDates(this.preinittedData.vicinityDates);
				this.serviceClass(this.preinittedData.serviceClass);

				// Passengers
				for (var i in this.options.passengerCount) {
					if (this.options.passengerCount.hasOwnProperty(i)) {
						tmpass[i] = ko.observable(0);
					}
				}

				this.passengers(tmpass);

				this.fillPreInittedPassengers(this.passengerAdultTypes);
				this.fillPreInittedPassengers(this.passengerInfantTypes);

				// Types that are not ADT/INF
				tmp = [];

				for (var i = 0; i < this.passengerTypesOrder.length; i++) {
					if (
						this.passengerAdultTypes.indexOf(this.passengerTypesOrder[i]) < 0 &&
						this.passengerInfantTypes.indexOf(this.passengerTypesOrder[i]) < 0
					) {
						tmp.push(this.passengerTypesOrder[i]);
					}
				}

				this.fillPreInittedPassengers(tmp);
			}
			else {
				for (var i = 0; i < this.$$rawdata.flights.search.request.segments.length; i++) {
					var data = this.$$rawdata.flights.search.request.segments[i];

					// departureDate = 2015-04-11T00:00:00
					this.addSegment(
						data.departure ? this.$$controller.getModel('FlightsSearchForm/FlightsSearchFormGeo', {data: data.departure, guide: this.$$rawdata.guide}) : null,
						data.arrival ? this.$$controller.getModel('FlightsSearchForm/FlightsSearchFormGeo', {data: data.arrival, guide: this.$$rawdata.guide}) : null,
						data.departureDate ? this.$$controller.getModel('common/FlightsSearchFormDate', data.departureDate) : null
					);
				}

				// Processing other options
				this.tripType(this.$$rawdata.flights.search.request.parameters.searchType);
				this.directFlights(this.$$rawdata.flights.search.request.parameters.direct);
				this.vicinityDates(this.$$rawdata.flights.search.request.parameters.aroundDates != 0);

				// Passengers
				for (var i in this.options.passengerCount) {
					if (this.options.passengerCount.hasOwnProperty(i)) {
						tmpass[i] = ko.observable(tmpass[i] ? tmpass[i] : 0);
					}
				}

				this.passengers(tmpass);

				if (this.serviceClasses.indexOf(this.$$rawdata.flights.search.request.parameters.serviceClass) >= 0) {
					this.serviceClass(this.$$rawdata.flights.search.request.parameters.serviceClass);
				}
			}

			// All seems OK - starting search if needed
			if (this.mode == 'preinitted' && this.preinittedData.immediateSearch) {
				this.$$loading(false);
				this.startSearch();
			}
		};

		FlightsSearchFormController.prototype.createGeoPiont = function () {

		};

		FlightsSearchFormController.prototype.addSegment = function (departure, arrival, departureDate) {
			this.segments.push(
				this.$$controller.getModel(
					'FlightsSearchForm/FlightsSearchFormSegment',
					{
						departure: departure,
						arrival: arrival,
						departureDate: departureDate,
						index: this.segments().length,
						form: this
					}
				)
			);
		};

		FlightsSearchFormController.prototype.continueCR = function () {
			var segsCount = this.segments().length;

			if (this.tripType() == 'CR' && segsCount < this.options.flightSegments) {
				this.addSegment(this.segments()[segsCount - 1].items.arrival.value(), null, null);
			}
		};

		FlightsSearchFormController.prototype.removeLastCRSegment = function () {
			var segsCount = this.segments().length;

			if (this.tripType() == 'CR' && segsCount > 1) {
				this.segments.pop();
			}
		};

		FlightsSearchFormController.prototype.$$usedModels = [
			'FlightsSearchForm/FlightsSearchFormSegment',
			'common/FlightsSearchFormDate',
			'FlightsSearchForm/FlightsSearchFormGeo'
		];

		FlightsSearchFormController.prototype.dataURL = function () {
			var ret = '/flights/search/formData/';

			if (this.mode == 'tunesearch') {
				ret += this.tuneSearch;
			}

			return ret;
		};

		FlightsSearchFormController.prototype.dataPOSTParameters = function () {
			var ret = {},
				tmp = {};

			if (this.mode == 'preinitted') {
				for (var i = 0; i < this.preinittedData.segments.length; i++) {
					tmp[this.preinittedData.segments[i][0]] = this.preinittedData.segments[i][0];
					tmp[this.preinittedData.segments[i][1]] = this.preinittedData.segments[i][1];
				}

				ret.cities = ret.airports = Object.keys(tmp);
//				ret.airports = ['IEV'];
//				ret.countries = [];
			}

			return ret;
		};

		return FlightsSearchFormController;
	}
);