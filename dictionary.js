Dictionary = function () {
    this.items = {};
};

Dictionary.prototype.get = function (key) {
    if (Object.prototype.hasOwnProperty.call(this.items, key))
        return this.items[key];
};

Dictionary.prototype.set = function (key, value) {
    this.items[key] = value;
};

Dictionary.prototype.remove = function (key) {
    this.items[key] = null;
};

Dictionary.prototype.size = function () {
    var size = 0, key;
    for (key in this.items) {
        if (this.items.hasOwnProperty(key))
            size++;
    }
    return size;
};

