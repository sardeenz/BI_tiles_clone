angular.module('businessTiles', [])
.directive('flipTile', function () {
    return {
        restrict: 'E',
        templateUrl: 'flipTile.html',
        scope: {
            factory: '=',
            cardTitle: '=',
            subtitle: '=',
            valueField: '=',
            method: '=',
            table: '=',
            fields: '=',
            parameters: '=',
            frequency: '=',
            labelField: '='
        },
        controller: function ($scope, $injector, $interval) {
            getCounts();
            $interval(getCounts, $scope.frequency);
           function getCounts () {
                $injector.get($scope.factory)[$scope.method]($scope.table, $scope.fields, $scope.parameters).then(function (count) {
                    $scope.value = count[$scope.valueField];
                    $scope.updated = moment().format('MMMM Do YYYY, h:mm:ss a');
                    if (count.geojson) {
                        if (!$scope.geojson) {
                            $scope.geojson = L.geoJson(count.geojson, {onEachFeature: function (feature, layer) {
                                if ($scope.labelField) {
                                    layer.bindLabel(feature.properties[$scope.labelField]);
                                }
                            }}).addTo($scope.map);
                            $scope.map.fitBounds($scope.geojson.getBounds());
                        }
                        
                        $scope.geojson.clearLayers();
                        $scope.geojson.addData(count.geojson);
                        
                    }
                    
                });      
           }

        }, link: function (scope, element, attrs) {
            scope.map = L.map(element[0].querySelector('.map'));
            var hour = new Date().getHours();
            var baseUrl = 'http://{s}.basemaps.cartocdn.com/' + ((hour > 17 || hour < 6) ? 'dark' : 'light') + '_all/{z}/{x}/{y}.png';
            var tiles = L.tileLayer(baseUrl,{
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
                subdomains: 'abcd',
                minZoom: 4,
                maxZoom: 16
            });
            scope.map.addLayer(tiles); 
            scope.map.setView([35.5, -78.8], 12);
            scope.map.on('load', function(e) {
                alert('load'); // e is an event object (MouseEvent in this case)
            });
        }
    }
})
.controller('businessCtrl', ['$scope', function($scope){
    $scope.tiles = [

    // {factory:"transloc", cardTitle:"Buses In Service", subtitle:"in service", valueField:"count", method:"getVehicleCount", frequency:"5000", labelField: "call_name"},
    // {factory:"transloc", cardTitle:"Average Bus Speed (mph)", subtitle:"average speed", valueField:"speed", method:"getVehicleCount", frequency:"5000", labelField: "speed"},
     {factory:"cityworks", cardTitle:"Open See Click Fixes", subtitle:"Open in See Click Fix", valueField:"COUNT", method:"getCount", table:"azteca.request", fields:"SRX, SRY, DESCRIPTION", parameters:"initiatedby = 'FIX, SEE CLICK' and not (status in ('CANCEL','CANCEL NOT FOUND', 'CANCEL OTHER', 'CLOSED'))", frequency:"10000", labelField: "DESCRIPTION"},    
    {factory:"iris", cardTitle:"Permits Issued Today", subtitle:"Permits Issued Today", valueField:"COUNT", method:"getIrisCount", table:"iris.permits_all_view", fields:"NCPIN,GRP_PROPOSED_WORK", parameters:"grp_issue_date>= trunc(sysdate)", frequency:"10000", labelField: "GRP_PROPOSED_WORK"},    
    ];
}])
.factory('iris', ['$http', '$q', function($http, $q){
    var irisUrl = 'http://gisdevarc1/dirt-simple-iris/v1/ws_geo_attributequery.php';
    var service = {};
    service.getIrisCount = function (table, fields, params) {
        var d = $q.defer();
        $http.jsonp(irisUrl, {
            params: {
                table: table,
                fields: fields,
                parameters: params,
                callback: 'JSON_CALLBACK'
            }
        }).success(function (data) {
            var gj = {
              type: "FeatureCollection",
              features: [

              ]
            };            
            angular.forEach(data, function (d) {
                var ll = getLatLngFromPIN(d.NCPIN);
                gj.features.push({type: 'Feature', geometry: {type: 'Point', coordinates:ll}, properties: d});
            });
            d.resolve({COUNT: data.length, geojson: gj});
        });
        return d.promise;
    }
    function getLatLngFromPIN (pin) {
                var x = '2' + pin[0].toString() +pin[2].toString() + pin[4].toString() + pin[6].toString() + pin[8].toString() + '0';
                var y =  pin[1].toString() +pin[3].toString() + pin[5].toString() + pin[7].toString() + pin[9].toString() + '0';  
                var ll = spToDD(x, y);
                return [ll[1], ll[0]]                
           } 
    return service;
}])
.factory('cityworks', ['$http', '$q', function($http, $q){
    var irisUrl = 'http://gisdevarc1/dirt-simple-cwreporting/v1/ws_geo_attributequery.php';
    var service = {};
    service.getCount = function (table, fields, params) {
        var d = $q.defer();
        $http.jsonp(irisUrl, {
            params: {
                table: table,
                fields: fields,
                parameters: params,
                callback: 'JSON_CALLBACK'
            }
        }).success(function (data) {
            var gj = {
              type: "FeatureCollection",
              features: [

              ]
            };
                                 angular.forEach(data, function (d) {
                    var ll = spToDD(d.SRX, d.SRY);
                    ll = [ll[1], ll[0]];
                    gj.features.push({type: 'Feature', geometry: {type: 'Point', coordinates:ll}, properties: d});
                });
            d.resolve({COUNT: data.length, geojson: gj});
        });
        return d.promise;
    }
    return service;
}])
.factory('transloc', ['$http', '$q', function($http, $q){
    var baseUrl = 'https://transloc-api-1-2.p.mashape.com/';
    var headers = {'X-Mashape-Key': 'QcvihLtHdgmshtY0Yjsg7nytW4Iqp1MEy05jsnSqvl1Lqjt9eW'};
    var service = {};
    service.getVehicleCount = function () {
        var d = $q.defer();
        $http({
            url: baseUrl + '/vehicles.json',
            params: {
                agencies: '20', 
            },
            headers: headers
        }).success(function (data) {
            var speed = 0;
            var gj = {
              type: "FeatureCollection",
              features: [

              ]
            };

            angular.forEach(data.data[20], function (v) {
                speed += v.speed;
                gj.features.push({type: 'Feature', geometry: {type: 'Point', coordinates:[v.location.lng, v.location.lat]}, properties: {call_name: v.call_name, speed: Math.round(v.speed).toString()}});
            });
            d.resolve({count: data.data[20].length, speed: Math.round(speed/data.data[20].length), geojson: gj});
        });
        return d.promise;
    }
    return service;
}]);