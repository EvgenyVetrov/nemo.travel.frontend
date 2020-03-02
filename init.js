if (typeof nemoSourceHost == 'undefined' || !nemoSourceHost) {
    throw new Error('Variable "nemoSourceHost" must be initialized')
}
if (typeof nemoDataUrl == 'undefined' || !nemoDataUrl) {
    throw new Error('Variable "nemoDataUrl" must be initialized')
}
if (typeof nemoBaseUrl == 'undefined' || !nemoBaseUrl) {
    throw new Error('Variable "nemoBaseUrl" must be initialized')
}
if (typeof nemoStaticUrl == 'undefined' || !nemoStaticUrl) {
    throw new Error('Variable "nemoBaseUrl" must be initialized')
}
if (typeof nemoInitData == 'undefined' || !nemoInitData) {
    var nemoInitData = {disableCookies: true};
}

if (typeof appLanguageId == 'undefined' || !appLanguageId) {
    var appLanguageId = 'en';
}


require.config({
    // Common libraries
    paths: {
        domReady: nemoSourceHost + '/js/lib/requirejs/domReady',
        text: nemoSourceHost + '/js/lib/requirejs/text',
        knockout: nemoSourceHost + '/js/lib/knockout/v.3.2.0/knockout-3.2.0',
        AppController: nemoSourceHost + '/js/NemoFrontEndController',
        jquery: '/js/jquery-2.1.3-pjax.min',
        jqueryUI: nemoSourceHost + '/js/lib/jqueryUI/v.1.11.4/jquery-ui.min',
        jsCookie: nemoSourceHost + '/js/lib/js.cookie/v.2.0.0/js.cookie',
        tooltipster: nemoSourceHost + '/js/lib/tooltipster/jquery.tooltipster.min',
        numeralJS: nemoSourceHost + '/js/lib/numeral.js/v.1.5.3/numeral.min',
        mousewheel: nemoSourceHost + '/js/lib/jquery.mousewheel/jquery.mousewheel.min',
        touchpunch: nemoSourceHost + '/js/lib/jquery.ui.touch-punch/v.0.2.3/jquery.ui.touch-punch.min'
    },

    baseUrl: nemoSourceHost,
    enforceDefine: true,
    waitSeconds: 300,

    // Overriding requirejs.text so templates will ALWAYS be fetched via XHR request
    // RTFM: https://github.com/requirejs/text#xhr-restrictions
    config: {
        text: {
            useXhr: function (url, protocol, hostname, port) {
                // Override function for determining if XHR should be used.
                // Return true means "use xhr", return false means "fetch the .js version of this resource".
                return true;
            }
        }
    }
});

require(
    ['AppController'],
    function (AppController) {
        var options = {
                controllerSourceURL: nemoSourceHost,
                dataURL: nemoDataUrl, //'http://conchita.mlsd.ru/api',
                staticInfoURL: nemoStaticUrl,
                version: 'v1.38.2.1455722074',
                hostId: document.location.host,
                root: window.primitiveSearch ? '/flight/search' : nemoBaseUrl,
                postParameters: {},
                i18nLanguage: appLanguageId,
                componentsAdditionalInfo: {
                    'Flights/SearchForm/Controller': nemoInitData
                }
            },
            controller;

        console.warn(JSON.stringify(options));

        // Before booking flight, replace original Nemo flight ids with Nemo 2 ids.
        AppController.prototype.extend(
                'Flights/SearchResults/Controller',
                function () {
                        var controller = this;

                        controller.handleFlightIdsBeforeBooking = function (flightIds) {
                                if (flightIds instanceof Array) {
                                        return flightIds.map(function (flightId) {
                                                return controller.flights.hasOwnProperty(flightId) ? controller.flights[flightId].nemo2id : flightId;
                                        });
                                }
                                else {
                                        return flightIds;
                                }
                        };
                }
        );

        // Before booking flight from fare families selection popup,
        // replace original Nemo flight ids with Nemo 2 ids.
        AppController.prototype.extend(
                'Flights/SearchResults/FareFamiliesBySegment/Controller',
                function () {
                        var controller = this;

                        controller.handleFlightIdsBeforeBooking = function (flightIds) {
                                if (flightIds instanceof Array) {
                                        return flightIds.map(function (flightId) {
                                                return controller.flightsById.hasOwnProperty(flightId) ? controller.flightsById[flightId].nemo2id : flightId;
                                        });
                                }
                                else {
                                        return flightIds;
                                }
                        };
                }
        );

        AppController.prototype.extend('Flights/SearchResults/Flight', function () {

            this.tpAccept = this.$$controller.checkTpAccept(this.id);
            if (!this.tpAccept) {
                this.TPwarnings.push({type: 'text', text: 'TP__accept_false_warning'});
                var ext = {}, i = 'tp_message_' + this.id;
                ext[i] = this.$$controller.getTpMessage(this.id);
                AppController.prototype.i18nExtend({
                    'FlightsSearchResults': ext
                });
                this.TPwarnings.push({type: 'text', text: i});
            }

            this.tpReject = this.$$controller.checkTpReject(this.id);
            if (this.tpReject) {
                this.TPwarnings.push({type: 'text', text: 'TP__reject'});
            }
            this.isLowestPrice = this.$$controller.checkLowestPrice(this.id);
            this.isOptimalFlight = this.$$controller.checkOptimalFlight(this.id);
        });

        //AppController.prototype.extend('Flights/SearchResults/FareFamilies/Controller', function () {
//            var self = this;
//            console.log(self.parentFlight.id_);
//        });

        AppController.prototype.extend('Flights/SearchForm/Controller', function () {
            var self = this;
            this.passengersRestrictions.subscribe(function (newValueOfPassengerRestrictions) {
                $.each(nemoInitData.init.passengers, function (type, total) {
                    self.setPassengers(type, total);
                });
            });
        });

        AppController.prototype.extend('Flights/SearchResults/Controller', function () {
            setcookie("searchFlightBackUrl", window.location.pathname, {path:'/'});
            var self = this;
            AppController.prototype.checkTpAccept = function(flightId) {
                return typeof self.$$rawdata.flights.search.results.tpMessages[flightId] == 'undefined';
            };
            AppController.prototype.getTpMessage = function(flightId) {
                if (typeof self.$$rawdata.flights.search.results.tpMessages[flightId] == 'undefined') {
                    return '';
                }
                return self.$$rawdata.flights.search.results.tpMessages[flightId];
            };
            AppController.prototype.checkTpReject = function(flightId) {
                if (typeof self.$$rawdata.flights.search.results.rejected != 'undefined') {
                    return self.$$rawdata.flights.search.results.rejected.indexOf(flightId) >= 0;
                }
                return false;
            };
            AppController.prototype.checkLowestPrice = function(flightId) {
                if (typeof self.$$rawdata.flights.search.results.lowest != 'undefined') {
                    return self.$$rawdata.flights.search.results.lowest.indexOf(flightId) >= 0;
                }
                return false;
            };

            AppController.prototype.checkOptimalFlight = function(flightId) {
                if (typeof self.$$rawdata.flights.search.results.optimal != 'undefined') {
                    return self.$$rawdata.flights.search.results.optimal.indexOf(flightId) >= 0;
                }
                return false;
            };

            AppController.prototype.expandPanel = function() {
                return 'min-height:' + expandToBottom('.nemo-flights-results', -37, true) + 'px';
            };

            this.expandPanel = this.$$controller.expandPanel();

            this.postfiltersData.configs.travelPolicy = {
                name: 'travelPolicy',
                type: 'String',
                isLegged: false,
                legNumber: 0,
                getter: function (obj) {
                    return [[obj.tpAccept, obj.tpAccept]];
                },
                options: {}
            };
            this.postfiltersData.configs.lowestPrice = {
                name: 'lowestPrice',
                type: 'String',
                isLegged: false,
                legNumber: 0,
                getter: function (obj) {
                    return [[obj.isLowestPrice, obj.isLowestPrice]];
                },
                options: {}
            };

            this.postfiltersData.configs.optimalFlight = {
                name: 'optimalFlight',
                type: 'String',
                isLegged: false,
                legNumber: 0,
                getter: function (obj) {
                    return [[obj.isOptimalFlight, obj.isOptimalFlight]];
                },
                options: {}
            };

            this.postfiltersData.order.push('travelPolicy');
            this.postfiltersData.order.push('lowestPrice');
        });
        /*TODO Translate*/
        AppController.prototype.i18nExtend({
            'FlightsSearchResults': FlightsSearchResults,
            'FlightsSearchForm': FlightsSearchForm
        });
        AppController.prototype.extend('Flights/SearchResults/Group', function () {
            var self = this;
            self.isLowestPrice = function () {
                return self.flights[0].isLowestPrice;
            };
            self.isOptimalFlight = function () {
                return self.flights[0].isOptimalFlight;
            };
        });

        controller = new AppController(document.getElementsByClassName('js-nemoApp')[0], options);
    }
);

function set_offline(url) {
    if (window.tripType == 1) {
        disableOfflineForPrivateTrip();
        return;
    }

    var yes = SetOffline.yes;//"Save offline order"
    var no = SetOffline.no; //"Return to online search"
    var offline_comment = SetOffline.comment; //"Return to online search"

    var text = SetOffline.text;//"Вы можете сохранить заказ оффлайн и указать Ваши предпочтения в комментариях"; //You can save offline order and put your requirements in the comments
    swal({
        title: text,
        text: "<form style='height: 200px;' action='"+url+"' method='post' id='offline_form'><textarea class='form-control' name='offline_comment' rows='9' maxlength='990'>"+offline_comment+"</textarea><form>",
        html: true,
        type: "warning",
        showCancelButton: true,
        confirmButtonColor: "#64b5f6",
        confirmButtonText: yes,
        cancelButtonText: no
    }, function (isConfirm) {
        if (isConfirm) {
            document.getElementById('offline_form').submit();
        }
        });
}

$('body').addClass('overflow-auto');

$(document).on('click', '.nemo-flights-results__flightsGroup__footer__TP_header', function(){

    $(this)
        .closest('.nemo-flights-results__flightsListGroup__buyButtonCnt__inner,.nemo-flights-results__flightsGroup__footer__disclaimers')
        .find('.nemo-flights-results__flightsGroup__footer__TP_content')
        .toggle();
});