var inflection = require('inflection');
var pathProxy = require('path-proxy');
var Q = require('q');

var noop = function () {};

var Builder = function (baseObj, resources) {
  this.baseObj = baseObj;
  this.resources = resources;
};

Builder.prototype.build = function () {
  for (var key in this.resources) {
    console.log('building ' + key);
    this.buildResource(this.resources[key]);
  }
};

Builder.prototype.buildResource = function (resource) {
  resource.links.forEach(this.buildAction, this);
};

Builder.prototype.buildAction = function (action) {
  var constructor = pathProxy.pathProxy(this.baseObj, action.href);
  var actionName = action.title;
  var properties = action.properties;
  var requiredProps = action.required;

  constructor.prototype[getName(actionName)] = function (data, fn) {
    var deferred = Q.defer();

    // HACKY special case for members bulk add
    if(action.href === '/lists/{address}/members' && actionName === 'add') {
      action.href = '/lists/{address}/members.json'
    }

    var requestPath = action.href;
    var pathParams = action.href.match(/{[^}]+}/g) || [];

    if (typeof data === 'function') {
      fn = data;
      data = undefined;
    }

    if (!fn) fn = noop;

    if (this.params.length !== pathParams.length) {
      var err = new Error('Invalid number of params in path (expected ' + pathParams.length + ', got ' + this.params.length + ').');
      return rejectError(err, deferred, fn);
    }

    this.params.forEach(function (param) {
      requestPath = requestPath.replace(/{[^}]+}/, param);
    });

    var err;

    // check required payload properties
    if (requiredProps && requiredProps.length > 0) {
      for (var i = 0; i < requiredProps.length; i++) {
        var prop = requiredProps[i];
        if (typeof data[prop] === 'undefined') {
          err = new Error('Missing parameter \'' + prop + '\'');
          break;
        }
      }
    }

    if (err) {
      return rejectError(err, deferred, fn);
    }

    // check payload property types
    for (var key in properties) {
      var type = properties[key].type;
      if (data && data[key] && type && (typeof data[key] !== type)) {
        err = new Error('Invalid parameter type. ' + key + ' must be of type: ' + type + '.');
        break;
      }
    }

    if (err) {
      return rejectError(err, deferred, fn);
    }

    this.client = this.base;
    return this.client.request(action.method, requestPath, data, fn);
  };
};

function rejectError(err, deferred, fn) {
  deferred.reject(err);
  fn(err);
  return deferred.promise;
}

function getName(name) {
  name = name.toLowerCase();
  name = inflection.dasherize(name).replace(/-/g, '_');
  name = inflection.camelize(name, true);

  return name;
}

exports.build = function (baseObj, resources) {
  var b = new Builder(baseObj, resources);
  b.build();
};




