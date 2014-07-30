define(['angular'], function (angular) {
    'use strict';

    /* Directives */

    var mapModule = angular.module('Map', []);

    var isEmptyObject = function(obj) {
        var key;
        for(key in obj) {
            return false;
        }
        return true;
    }

    mapModule.service('MapService', ['$http',
        function($http) {

            var MAP_TYPE, IS_BMAP, IS_GMAP;

            var _setMapType = function(type) {
                MAP_TYPE = type;

                IS_BMAP = MAP_TYPE == 'baidu';
                IS_GMAP = MAP_TYPE == 'google';

                if(!IS_BMAP && !IS_GMAP) {
                    console.error('unknow map type');
                }
            };

            var _getMapUrl = function() {
                var url;
                if(IS_BMAP) {
                    url = requirejs.toUrl('bmap') || 'http://api.map.baidu.com/api?v=2.0&ak=mHUf8ZoVWhqDoAYFKd0QTGCn';
                }
                else if(IS_GMAP) {
                    url = requirejs.toUrl('gmap') || 'https://maps.googleapis.com/maps/api/js?sensor=false&language=zh-CN';
                }
                return url && (url + '&callback=mapLoadCallback');
            };

            var _isMapLoaded = function() {
                if(IS_BMAP) {
                    return typeof BMap !== 'undefined' && isEmptyObject(BMap.Map);
                }
                else if(IS_GMAP) {
                    return typeof google !== 'undefined' && !isEmptyObject(google.maps);
                }
                return false;
            };

            var _ready = function(callback) {
                if(!MAP_TYPE) {
                    return;
                }

                if(typeof callback !== 'function') {
                    callback = function() { console.log('Map load success!') };
                }

                if(_isMapLoaded()) {
                    callback();
                }
                else {
                    window.mapLoadCallback = function() {
                        delete window.mapLoadCallback;

                        callback();
                    };
                    $http.jsonp(_getMapUrl());
                }
            };

            var Point = function(lat, lng) {
                var _point;
                if(IS_BMAP) {
                    _point = new BMap.Point(lng, lat);
                }
                else if(IS_GMAP) {
                    _point = new google.maps.LatLng(lat, lng);
                }
                return _point;
            };

            var _map;
            var _initMap = function(containerId, centerPoint, zoom) {
                if(IS_BMAP) {
                    _map = new BMap.Map(containerId);
                    _map.centerAndZoom(centerPoint, zoom);
                    _map.enableScrollWheelZoom();

                    _map.addEventListener('mousedown', function(e) {
                        e.domEvent.stopPropagation();
                    });
                }
                else if(IS_GMAP) {
                    _map = new google.maps.Map(document.getElementById(containerId), {
                        zoom: zoom,
                        center: centerPoint,
                        mapTypeId: google.maps.MapTypeId.ROADMAP
                    });
                }
                return _map;
            };

            return {
                setMapType: _setMapType,
                ready: _ready,
                Point: Point,
                initMap: _initMap
            };
        }
    ]);

    mapModule.directive('map', function(MapService) {
        return {
            restrict: 'A',
            scope: {
                place: '=?'
            },
            link: function($scope, $elem, $attr) {
                var map, startP, endP, local, transit;

                $elem.attr('id', 'map-' + Date.now() + '-' + Math.round(Math.random() * 100));

                $scope.$watch('place', function(newValue, oldValue) {
                    if(newValue == oldValue) return;

                    local.search(newValue);
                });

                function transitSearch() {
                    if(startP && endP) {
                        local.clearResults();
                        transit.search(startP, endP);
                    }
                }

                MapService.setMapType('baidu');
                MapService.ready(function() {
                    map = new BMap.Map($elem.attr('id'));
                    map.centerAndZoom(new BMap.Point(121.499734, 31.239703), 15);
                    map.enableScrollWheelZoom();

                    map.addEventListener('mousedown', function(e) {
                        e.domEvent.stopPropagation();
                    });

                    local = new BMap.LocalSearch(map, {
                        renderOptions: { map: map },
                        // pageCapacity: 1,
                        onSearchComplete: function(results){
                            if (local.getStatus() == BMAP_STATUS_SUCCESS){
                                for (var i = 0; i < results.getCurrentNumPois(); i++) {
                                    endP = results.getPoi(i).point;
                                    transitSearch();
                                    break;
                                }
                            }
                        }
                    });

                    transit = new BMap.TransitRoute(map, {
                        renderOptions: { map: map }
                    });

                    local.search($scope.place);

                    navigator.geolocation.getCurrentPosition(function(pos) {
                        // startP = new BMap.Point(pos.coords.latitude, pos.coords.longitude);
                        startP = new BMap.Point(121.601980, 31.204089);
                        transitSearch();
                    }, function(error) {
                        console.log('Unable to get location: ' + error.message);
                    });
                });
            }
        };
    });


    // @todo: bmap example
    var CustomOverlay = function(point, boxClass) {
        this._point = point;
        this._boxClass = boxClass;

        this._box = document.createElement("div");
        this._box.className = this._boxClass;
    }
    CustomOverlay.prototype = new BMap.Overlay();
    CustomOverlay.prototype.initialize = function(_map) {
        this._map = _map;

        var div = this._div = document.createElement("div");
        div.style.position = 'absolute';

        div.appendChild(this._box);

        // map.getPanes().labelPane.appendChild(div);

        return div;
    }
    CustomOverlay.prototype.draw = function() {
        var map = this._map;
        var pixel = map.pointToOverlayPixel(this._point);

        this._div.style.left = pixel.x + 'px';
        this._div.style.top = pixel.y + 'px';
    }
    CustomOverlay.prototype.addListener = function(type, handler) {
        this._box.addEventListener(type, handler, false);
    }
    CustomOverlay.prototype.setContent = function(_content) {
        this._box.innerHTML = _content;
    }
    CustomOverlay.prototype.setStyle = function(_style) {
        for(var key in _style) {
            this._box.style[key] = _style[key];
        }
    }
    CustomOverlay.prototype.setPosition = function(point) {
        var map = this._map;
        var pixel = map.pointToOverlayPixel(point);

        this._div.style.left = pixel.x + 'px';
        this._div.style.top = pixel.y + 'px';
    }

    var marker = new CustomOverlay(storeLatLng, 'mapMarker mapMarker-' + priority + '');
    map.addOverlay(marker);

    marker.addListener('click', function() {
        map.centerAndZoom(storeLatLng, 15);

        var content = [
            '<p class="infoWindow_head"></p>',
            '<p class="infoWindow_content"></p>',
        ].join('');

        var style = { borderColor: 'rgba(0, 0, 0, .3)' };

        infowindow.setContent(content);
        infowindow.setStyle(style);
        infowindow.setPosition(storeLatLng);
        infowindow.show();
    });

    var origin = centerLatLng;
    var destination = storeLatLng;

    var driving = new BMap.DrivingRoute(map, {
        renderOptions: { map: map, autoViewport: true },
        onMarkersSet: function(poi) {
            poi.forEach(function(p) {
                p.marker.hide();
            });
        },
        onPolylinesSet: function(routes) {
            var route = routes[0];
            var polyline = route.getPolyline();
            polyline.setStrokeColor(color);
            polyline.setStrokeOpacity(0);
            polyline.setStrokeWeight(3);
        }
    });
    driving.search(origin, destination);

    // @todo: gmap example
    var directionsService = new google.maps.DirectionsService();
    var directionsRenderers = {};
    var infowindow = new InfoBox({
        content: '',
        maxWidth: 0,
        pixelOffset: new google.maps.Size(-18, -6),
        zIndex: null,
        alignBottom: true,
        boxClass: 'infoWindow_container',
        closeBoxURL: '',
        infoBoxClearance: new google.maps.Size(1, 1),
        pane: "floatPane",
        enableEventPropagation: true
    });
    google.maps.event.addListener(infowindow, 'domready', function() {
        $('.infoWindow_container').on('mouseleave', function() {
            $(this).fadeOut(500);
        });
    });

    var centerMarker = new RichMarker({ map: map, position: centerLatLng, flat: true, content: '<div class="mapMarker"></div>' });

    var mapData = {};
    $.each(ko.unwrap(this.dataSet.filterByPropertys(this.filters)), function(index, item) {
        var store_id = item.trans_store_id();
        if(!mapData[store_id]) {
            mapData[store_id] = ko.mapping.toJS(item);
            mapData[store_id].profit = $.isNumeric(mapData[store_id].profit) ? parseFloat(mapData[store_id].profit) : 0;
            mapData[store_id].cost = $.isNumeric(mapData[store_id].cost) ? parseFloat(mapData[store_id].cost) : 0;
        }
        else {
            mapData[store_id].profit += item.profit();
        }
    });

    var colorArray = [, '#009de0', '#ab218e', '#008a3b', '#004990', '#000000'];
    var format = '0,0';
    var zIndex = 1;
    for(var store_id in mapData) {
        var void1 = function() {
            var item = mapData[store_id];

            item.income = item.profit - item.cost;

            var storeLatLng = new google.maps.LatLng(item.latitude, item.logitude);
            var priority = item.priority > 0 && item.priority < 5 ? item.priority : 5;
            var color = colorArray[priority];

            var marker = new RichMarker({ map: map, position: storeLatLng, flat: true, content: '<div class="mapMarker mapMarker-' + priority + '"></div>' });

            google.maps.event.addListener(marker, 'click', function() {

                var drender = directionsRenderers[item.trans_store_id];
                var poptions = drender.polylineOptions;
                poptions.zIndex = zIndex++;
                drender.setOptions({ polylineOptions: poptions });
                drender.setDirections(drender.directions);

                infowindow.setOptions({ boxStyle: { 'borderColor': color, 'width': item.trans_store_nm.length * 12 + 50 + 'px' } });
                infowindow.setContent([
                    '<p class="infoWindow_head"></p>',
                    '<p class="infoWindow_content"></p>',
                ].join(''));
                infowindow.open(map, this);
            });

            var request = {
                origin: item.isExcessStock ? centerLatLng : storeLatLng,
                destination: !item.isExcessStock ? centerLatLng : storeLatLng,
                travelMode: google.maps.DirectionsTravelMode.DRIVING
            };

            directionsService.route(request, function(response, status) {
                if (status == google.maps.DirectionsStatus.OK) {
                    directionsRenderers[item.trans_store_id] = new google.maps.DirectionsRenderer({
                        map: map,
                        suppressMarkers: true,
                        polylineOptions: {
                            strokeColor: color,
                            strokeOpacity: 1,
                            strokeWeight: 3,
                            zIndex: 0,
                            icons: [{
                                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
                                offset: '100%'
                            }]
                       }
                    });
                    directionsRenderers[item.trans_store_id].setDirections(response);
                }
            });
        }();
    }

    var airlineOverlay = new google.maps.OverlayView();

    airlineOverlay.onAdd = function () {
        var layer = d3.select(this.getPanes().overlayLayer).append("div").attr("class", "airlineOverlay");

        self.$layer = $(layer[0]);
        isShow ? self.show() : self.hide();

        airlineOverlay.draw = function () {
            var projection = this.getProjection();

            var line = layer.selectAll('.mapRoutes').data(self.data).each(pathTransform)
                .enter().append('svg:svg').attr('class', 'mapRoutes').each(pathTransform);

            function pathTransform(d) {
                $(this).empty();

                self.lines[d.start + '-' + d.end] = this;

                var dsrc = new google.maps.LatLng(d.start_lat, d.start_lng),
                    dtrg = new google.maps.LatLng(d.end_lat, d.end_lng);

                var d1 = projection.fromLatLngToDivPixel(dsrc),
                    d2 = projection.fromLatLngToDivPixel(dtrg);

                // if(d.start == 'EGEDA' || d.end == 'EGEDA') debugger;

                var t = Math.min(d1.y, d2.y),
                    b = Math.max(d1.y, d2.y),
                    l = Math.min(d1.x, d2.x),
                    r = Math.max(d1.x, d2.x);

                var currentSvg = d3.select(this).style("left", (l - 10) + "px").style("top", (t - 10) + "px").style("width", (r - l + 20) + "px").style("height", (b - t + 20) + "px");

                var g = currentSvg.append("g").attr('transform', 'translate(10, 10)');

                g.append("svg:line").style("stroke-width", 3).style("stroke", self.getStroke(d))
                    .attr("x1", d1.x - l).attr("y1", d1.y - t)
                    .attr("x2", d2.x - l).attr("y2", d2.y - t);

                return currentSvg;
            }
        };
    };

    airlineOverlay.setMap(this.map);

    return mapModule;
});
