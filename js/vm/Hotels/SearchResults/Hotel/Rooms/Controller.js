'use strict';
define(
	['knockout', 'js/vm/helpers', 'js/vm/BaseControllerModel', 'js/lib/lodash/v.4.17.4/lodash.min'],
	function (ko, helpers, BaseControllerModel, _) {
		function HotelsSearchResultsHotelRoomsController(params) {
			BaseControllerModel.apply(this, arguments);
			
			this.hotel = params.hotel;
			this.resultsController = params.resultsController;

			/**
			 * Выбранные тарифы, сгруппированные по комнатам.
			 *
			 * @returns {Object}
			 */
			this.selectedRoomsTariffs = ko.observable({});

			/**
			 * Набор всех комнат с доступными тарифами.
			 *
			 * @returns {Array}
			 */
			this.rooms = ko.observableArray([]);

			/**
			 * Доступные комбинации тарифов.
			 *
			 * @returns {Object}
			 */
			this.tariffCombinations = ko.observable({});

			/**
			 * Выбранное пользователем платное позднее время выезда.
			 *
			 * @returns {Object}
			 */
			this.lateCheckOut = ko.observable(null);

			/**
			 * Выбранное пользователем платное раннее время заезда.
			 *
			 * @type {Object}
			 */
			this.earlyCheckIn = ko.observable(null);

			var newRooms = [],
				tariffs  = {};

			this.hotel.rooms.forEach(function (roomTariffs, roomIndex) {
				newRooms[roomIndex] = this.$$controller.getModel('Hotels/SearchResults/Hotel/Rooms/Room', {
					tariffs: roomTariffs ? roomTariffs : [],
					resultsController: this.resultsController,
					roomIndex: roomIndex
				});
			}, this);

			newRooms.forEach(function (room, index) {
				tariffs[index] = ko.observable(null);
			});

			this.rooms(newRooms);
			this.selectedRoomsTariffs(tariffs);
			this.tariffCombinations(_.clone(this.hotel.roomCombinations));

			/**
			 * Текущая выбранная юзером комбинация.
			 *
			 * @returns {String}
			 */
			this.currentCombination = ko.pureComputed(function () {
				var tariffs = this.selectedRoomsTariffs(),
					result = [];

				_.forOwn(tariffs, function (tariff) {
					result.push(tariff() ? tariff().id : 'X');
				});

				return result.join('_');
			}, this);

			/**
			 * Если нет комбинаций, то считаем, для всех ли комнат выбраны тарифы.
			 */
			this.allTariffsAreSelected = ko.pureComputed(function () {
				var numOfRooms = this.rooms().length,
					count = 0;
				
				_.forOwn(this.selectedRoomsTariffs(), function (selectedRoomTariffs) {
					if (selectedRoomTariffs()) {
						count++;
					}
				});
				
				return numOfRooms === count;
			}, this);

			/**
			 * Можно ли переходить к чекауту с текущий комбинацией тарифов в комнатах.
			 *
			 * @returns {Bool}
			 */
			this.canProceed = ko.pureComputed(function () {
				return !Object.keys(this.tariffCombinations()).length && this.allTariffsAreSelected() || this.currentCombination() in this.tariffCombinations();
			}, this);

			/**
			 * Полная стоимость выбранных тарифов.
			 *
			 * @returns {Number}
			 */
			this.totalRoomsPrice = ko.pureComputed(function () {
				if (!this.canProceed()) {
					return null;
				}

				var amount = 0,
					currency;

				_.forOwn(this.selectedRoomsTariffs(), function (selectedRoomTariffs) {
					if (selectedRoomTariffs()) {
						if (!currency) {
							currency = selectedRoomTariffs().rate.price.currency();
						}

						amount += selectedRoomTariffs().rate.price.amount();
					}
				});
				
				return this.$$controller.getModel('Common/Money', {
					amount: amount,
					currency: currency
				});
			}, this);
			
			this.totalRoomsPricePerNight = ko.pureComputed(function () {
				if (this.totalRoomsPrice()) {
					var numOfNights = parseInt(this.resultsController.countOfNights()),
						amount = this.totalRoomsPrice().amount();

					if (numOfNights) {
						amount /= numOfNights;
					}

					return this.$$controller.getModel('Common/Money', {
						amount: amount,
						currency: this.totalRoomsPrice().currency()
					});
				}
			}, this);

			this.lateCheckOutArray = ko.pureComputed(function () {
				var tmpArray = [{
					time: this.$$controller.i18n('HotelsSearchResults', 'hotels__lateCheckOut__time') + ' ' + this.hotel.staticDataInfo.checkOutTime
				}];

				if (this.hotel.lateCheckOutGroup) {
					for (var group in this.hotel.lateCheckOutGroup) {
						if (this.hotel.lateCheckOutGroup.hasOwnProperty(group)) {
							tmpArray.push(this.hotel.lateCheckOutGroup[group]);
						}
					}
				}

				return tmpArray;
			}, this);

			this.earlyCheckInArray = ko.pureComputed(function () {
				var tmpArray = [{
					time: this.$$controller.i18n('HotelsSearchResults', 'hotels__earlyCheckIn__time') + ' ' + this.hotel.staticDataInfo.checkInTime
				}];

				if (this.hotel.earlyCheckInGroup) {
					for (var group in this.hotel.earlyCheckInGroup) {
						if (this.hotel.earlyCheckInGroup.hasOwnProperty(group)) {
							tmpArray.push(this.hotel.earlyCheckInGroup[group]);
						}
					}
				}

				return tmpArray;
			}, this);

			this.earlyCheckInPrice = ko.pureComputed(function () {
				return this.hotel.earlyCheckInGroup.hasOwnProperty(this.earlyCheckIn().time) ?
					this.$$controller.getModel('Common/Money', {
						amount: this.hotel.earlyCheckInGroup[this.earlyCheckIn().time].price.amount,
						currency: this.hotel.earlyCheckInGroup[this.earlyCheckIn().time].price.currency
					}) : null;
			}, this);

			this.lateCheckOutPrice = ko.pureComputed(function () {
				return this.hotel.lateCheckOutGroup.hasOwnProperty(this.lateCheckOut().time) ?
					this.$$controller.getModel('Common/Money', {
						amount: this.hotel.lateCheckOutGroup[this.lateCheckOut().time].price.amount,
						currency: this.hotel.lateCheckOutGroup[this.lateCheckOut().time].price.currency
					}) : null;
			}, this);
		}

		helpers.extendModel(HotelsSearchResultsHotelRoomsController, [BaseControllerModel]);

		/**
		 * @param {Number} roomIndex
		 * @param {Object} roomTariff
		 */
		HotelsSearchResultsHotelRoomsController.prototype.selectTariffForRoom = function (roomIndex, roomTariff) {
			var selectedRoomTariff = this.selectedRoomsTariffs()[roomIndex];

			if (selectedRoomTariff()) {
				if (selectedRoomTariff() === roomTariff) {
					selectedRoomTariff(null);
				}
				else {
					selectedRoomTariff(null);
					selectedRoomTariff(roomTariff);
				}
			}
			else {
				selectedRoomTariff(roomTariff);
			}

			this.selectedRoomsTariffs.notifySubscribers();
		};

		return HotelsSearchResultsHotelRoomsController;
	}
);