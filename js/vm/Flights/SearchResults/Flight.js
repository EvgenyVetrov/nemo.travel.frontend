'use strict';
define(
	['knockout', 'js/vm/helpers', 'js/vm/BaseStaticModel'],
	function (ko, helpers, BaseModel) {
		function Flight (initialData, controller) {
			var tmp;

			BaseModel.apply(this, arguments);

			this.filteredOut = ko.observable(false);
			this.segmentsByLeg = [];
			this.legs = [];
			this.totalTimeEnRoute = null;
			this.timeEnRouteByLeg = [];
			this.transfers = [];
			this.transfersCount = 0;
			this.totalTimeTransfers = 0;
			this.isDirect = true;

			// Dividing segments by leg
			for (var i = 0; i < this.segments.length; i++) {
				if (this.segments[i].routeNumber != tmp) {
					this.segmentsByLeg.push([]);
					tmp = this.segments[i].routeNumber;
				}

				this.segmentsByLeg[this.segmentsByLeg.length - 1].push(this.segments[i]);
			}

			// Calculating total time in flight
			for (var i = 0; i < this.segmentsByLeg.length; i++) {
				var timeForLeg = 0;

				this.transfers.push([]);

				for (var j = 0; j < this.segmentsByLeg[i].length; j++) {
					timeForLeg += this.segmentsByLeg[i][j].flightTime;

					// Transfer time
					if (j > 0) {
						timeForLeg += this.segmentsByLeg[i][j].depDateTime.getTimestamp() - this.segmentsByLeg[i][j-1].arrDateTime.getTimestamp();

						this.transfers[i].push({
							duration: this.$$controller.getModel('common/Duration', this.segmentsByLeg[i][j].depDateTime.getTimestamp() - this.segmentsByLeg[i][j-1].arrDateTime.getTimestamp())
						});

						this.isDirect = false;
						this.transfersCount++;
						this.totalTimeTransfers += this.transfers[i][this.transfers[i].length - 1].duration.length();
					}
				}

				this.totalTimeEnRoute += timeForLeg;
				this.timeEnRouteByLeg.push(this.$$controller.getModel('common/Duration', timeForLeg));

				this.legs.push({
					depAirp: this.segmentsByLeg[i][0].depAirp,
					arrAirp: this.segmentsByLeg[i][this.segmentsByLeg[i].length - 1].arrAirp,
					depDateTime: this.segmentsByLeg[i][0].depDateTime,
					arrDateTime: this.segmentsByLeg[i][this.segmentsByLeg[i].length - 1].arrDateTime,
					timeEnRoute: this.timeEnRouteByLeg[this.timeEnRouteByLeg.length - 1]
				});
			}

			this.totalTimeEnRoute = this.$$controller.getModel('common/Duration', this.totalTimeEnRoute);
			this.recommendRating = 0 - ((this.totalTimeEnRoute.length() * this.getTotalPrice().normalizedAmount()) / ((this.getValidatingCompany().rating || 0) + (this.isDirect ? 1 : 0) + 1));
		}

		// Extending from dictionaryModel
		helpers.extendModel(Flight, [BaseModel]);

		Flight.prototype.getTotalPrice = function () {
			return this.price.totalPrice;
		};

		Flight.prototype.getValidatingCompany = function () {
			/**
			 * @CRUTCH in rare cases we don't have a validating company in price so we just crutch it
			 */
			return this.price.validatingCompany || this.segments[0].marketingCompany;
		};

		return Flight;
	}
);