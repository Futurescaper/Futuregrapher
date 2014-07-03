// This is a poor mans type checker. It allows you to check the contents of an object. It is disabled per default, 
// because of the performance penalty but you can turn it on in case you have a suspicious bug and maybe
// it will help you catch it. 

define(function() {

    TypeChecker = {
        enabled: false,
        logToConsole: false,
        
        // if strongCheck is true, no properties are allowed but the ones specified.
        checkProperties: function (object, requiredProperties, optionalProperties, strongCheck) {
            if (!this.enabled) return;

            var log = this.logToConsole ? function (m) { console.log(m); } : function () {};
            
            var keys = _.keys(object);

            var requiredNames = _.pluck(requiredProperties, "propertyName");
            _.each(requiredNames, function (n) { 
                if (keys.indexOf(n) === -1) {
                    var errorMessage = "Required property '" + n + "' was not found";
                    log(errorMessage);
                    throw new Meteor.Error(errorMessage); 
                }
            });

            if (strongCheck) {
                var legalNames = requiredNames.concat(_.pluck(optionalProperties, "propertyName"));

                _.each(keys, function (k) { 
                    if (legalNames.indexOf(k) === -1) {
                        var errorMessage = "Property '" + k + "' is not among allowed properties";
                        log(errorMessage);
                        throw new Meteor.Error(errorMessage); 
                    }
                });
            }            
            
            var validators = {};
            _.each(requiredProperties.concat(optionalProperties), function (p) { validators[p.propertyName] = p; });
            
            _.each(object, function (val, key) { 
                if (!validators[key].validate(val)) {
                    var errorMessage = "Property '" + key + "' should be a " + validators[key].typeName + ". Value was: " + val;
                    log(errorMessage);
                    throw new Meteor.Error(errorMessage); 
                }
            });
        },
        
        object: function (propertyName) {
            return {
                typeName: "object",
                propertyName: propertyName,
                validate: function (value) { return typeof value === "object";  }
            };
        },

        array: function (propertyName) {
            return {
                typeName: "array",
                propertyName: propertyName,
                validate: function (value) { return value instanceof Array; }
            };
        },
        
        string: function (propertyName) {
            return {
                typeName: "string",
                propertyName: propertyName,
                validate: function (value) { return _.isNull(value) || typeof value === "string";  }
            };
        },
        
        number: function (propertyName) {
            return {
                typeName: "number",
                propertyName: propertyName,
                validate: function (value) { return typeof value === "number" && !isNaN(value);  }
            };
        },
        
        nonNegativeNumber: function (propertyName) {
            return {
                typeName: "non-negative number",
                propertyName: propertyName,
                validate: function (value) { return typeof value === "number" && value >= 0;  }
            };
        },

        boolean: function (propertyName) {
            return {
                typeName: "boolean",
                propertyName: propertyName,
                validate: function (value) { return typeof value === "boolean";  }
            };
        },

        color: function (propertyName) {
            return {
                typeName: "color",
                propertyName: propertyName,
                validate: function (value) { return !_.isUndefined(value);  }   // TODO: Validate that this is indeed a color.. 
            };
        }
    };

    return TypeChecker;
});
