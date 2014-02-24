//testArrayProperty(test, visNodes, "id", ["cluster-cluster 1", "3", "4"]);

testProperties = function (test, actualObject, expectedValues, message) {
    for(var k in expectedValues) {
        if (!expectedValues.hasOwnProperty(k)) continue;
        
        test.equal(actualObject[k], expectedValues[k], message || ("Property " + k + " was incorrect"));
    }
}

testArrayProperty = function (test, objectArray, propertyName, propertyValues, message) {
    var actualPropertyValues = _(_(objectArray).pluck(propertyName)).sort();
    var expectedPropertyValues = _(propertyValues).sort();    
    
    test.equal(actualPropertyValues, propertyValues, message || ("Mismatch for property " + propertyName + "."));
}

