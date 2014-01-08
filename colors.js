// A basic color object
d3color = function(hexOrRgba) {
    if(hexOrRgba && typeof(hexOrRgba) === "string" && hexOrRgba.toLowerCase().indexOf('rgb') == 0) {
        var rgba = d3colors.getColorFromRgbText(hexOrRgba);
        this.color = { r: rgba ? rgba[0] : 0, g: rgba ? rgba[1] : 0, b: rgba ? rgba[2] : 0, a: rgba ? rgba[3] : 0 };
    }
    // if hex, then grab the colors as rgba
    else if(hexOrRgba && typeof hexOrRgba == "string" && (hexOrRgba.length == 6 || (hexOrRgba.length == 7 && hexOrRgba[0] == '#'))) {
        var rgba = d3colors.getRgbaFromHex(hexOrRgba);
        this.color = { r: rgba ? rgba[0] : 0, g: rgba ? rgba[1] : 0, b: rgba ? rgba[2] : 0, a: rgba ? rgba[3] : 0 };
    }
    else
        // just assign the values
        this.color = (!hexOrRgba || hexOrRgba.length < 3) ?
        { r: 0, g: 0, b: 0, a: 1 } :
        { r: hexOrRgba[0], g: hexOrRgba[1], b: hexOrRgba[2], a: (hexOrRgba.length > 3) ? hexOrRgba[3] : 1 };

    // Get or set the color's hex value
    this.hex = function(val) {
        if(!val)
            return d3colors.getHexFromRgb(this.color.r, this.color.g, this.color.b);

        var rgba = d3color.getRgbaFromHex(val);
        this.color = { r: rgba[0], g: rgba[1], b: rgba[2], a: rgba[3] };
    };

    // Get or set the color's rgba value
    this.rgba = function(val) {
        if(!val)
            return [this.color.r, this.color.g, this.color.b, this.color.a];

        if(val.length >= 3)
            this.color = { r: val[0], g: val[1], b: val[2], a: val.length > 3 ? val[3] : 1 };
    };

    // Gets the color's rgba values as a html color string - "rgb(r, g, b)"
    this.rgbastr = function() {
        var r = this.color.r > 256 ? 256 : Math.floor(this.color.r);
        var g = this.color.g > 256 ? 256 : Math.floor(this.color.g);
        var b = this.color.b > 256 ? 256 : Math.floor(this.color.b);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    };

    this.hsv = function() {
        return d3colors.rgbToHsv(this.color.r, this.color.g, this.color.b);
    }
};

d3colors = {
    getd3Color: function(color) {
        return color.length ? new d3color(color) : color;
    },

    // Blend two colors together at a certain % of blending
    blend: function(color1, color2, blend) {
        var col1 = this.getd3Color(color1);
        var col2 = this.getd3Color(color2);

        var rgb1 = col1.rgba();
        var rgb2 = col2.rgba();

        return new d3color([Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * blend),
            Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * blend),
            Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * blend),
            rgb1[3] + (rgb2[3] - rgb1[3]) * blend]);
    },

    // Takes an array of d3colors and returns the average of all of them
    average: function(colors) {
        if (!colors || colors.length == 0)
            return null;

        if (colors.length == 1)
            return colors[0];

        var totalR = 0, totalG = 0, totalB = 0;
        for ( var i = 0; i < colors.length; i++) {
            var rgb = colors[i].rgba();
            totalR += rgb[0];
            totalG += rgb[1];
            totalB += rgb[2];
        }

        return new d3color([totalR / colors.length, totalG / colors.length, totalB / colors.length, 1]);
    },

    // Gets a darker shade of the specified color, with val=0 being completely black and val=1 being no darker.  Defaults to .5
    darken: function(color, val) {
        var color = this.getRgbaFromHex(color.hex ? color.hex() : new d3color(color).hex());
        var r = color[0] * (val||.5);
        var g = color[1] * (val||.5);
        var b = color[2] * (val||.5);

        return new d3color([r, g, b]);
    },

    // Gets a lighter shade of the specified color, with val=0 being no lighter and val=1 being completely white.  Defaults to .5
    lighten: function(color, val) {
        var color = this.getRgbaFromHex(color.hex ? color.hex() : new d3color(color).hex());
        var r = color[0] + (255 - color[0]) * (val||.5);
        var g = color[1] + (255 - color[1]) * (val||.5);
        var b = color[2] + (255 - color[2]) * (val||.5);

        return new d3color([r, g, b]);
    },

    // Gets the color on a default spectrum at a certain ratio (between 0 and 1)
    spectrum: function(ratio) {
        if(ratio < 0 || ratio > 1.0)
            return '#666666';

        var i = parseInt(ratio * 255.0);
        var r = Math.round(Math.sin(0.024 * i) * 127 + 128);
        var g = Math.round(Math.sin(0.024 * i + 2) * 127 + 128);
        var b = Math.round(Math.sin(0.024 * i + 4) * 127 + 128);

        // and return a color matching that ratio along the full spectrum
        return new d3color([r, g, b]);
    },

    // Private methods
    getRgbaFromHex: function(hexColor) {
        return [
            parseInt(this._cutHex(hexColor).substring(0, 2), 16),
            parseInt(this._cutHex(hexColor).substring(2, 4), 16),
            parseInt(this._cutHex(hexColor).substring(4, 6), 16),
            1 ];
    },

    _cutHex: function(h) {
        return h.charAt(0) == '#' ? h.substring(1, 7) : h;
    },

    _2digit: function(s) {
        return (s.length >= 2) ? s : '0' + s;
    },

    getHexFromRgb: function(r, g, b) {
        return '#' + this._2digit(parseInt(r).toString(16))
            + this._2digit(parseInt(g).toString(16))
            + this._2digit(parseInt(b).toString(16));
    },

    getColorFromRgbText: function(text) {
        if(!text)
            return;

        var match = text[0] == '#' ? text.substr(1).match(/\d+/g) : text.match(/\d+/g);
        if(match && match.length >= 3)
            return [ parseInt(match[0]), parseInt(match[1]), parseInt(match[2]), 1 ];
    },

    hsvToRgb: function(h, s, v) {

        var s = s / 100,
            v = v / 100;

        var hi = Math.floor((h / 60) % 6);
        var f = (h / 60) - hi;
        var p = v * (1 - s);
        var q = v * (1 - f * s);
        var t = v * (1 - (1 - f) * s);

        var rgb = [];

        switch (hi) {
            case 0: rgb = [v, t, p]; break;
            case 1: rgb = [q, v, p]; break;
            case 2: rgb = [p, v, t]; break;
            case 3: rgb = [p, q, v]; break;
            case 4: rgb = [t, p, v]; break;
            case 5: rgb = [v, p, q]; break;
        }

        var r = Math.min(255, Math.round(rgb[0] * 256)),
            g = Math.min(255, Math.round(rgb[1] * 256)),
            b = Math.min(255, Math.round(rgb[2] * 256));

        return [r, g, b];
    },

    rgbToHsv: function(r, g, b) {
        var r = (r / 255),
            g = (g / 255),
            b = (b / 255);

        var min = Math.min(Math.min(r, g), b),
            max = Math.max(Math.max(r, g), b);

        var value = max,
            saturation,
            hue;

        // Hue
        if (max == min)
            hue = 0;
        else if (max == r)
            hue = (60 * ((g - b) / (max - min))) % 360;
        else if (max == g)
            hue = 60 * ((b - r) / (max - min)) + 120;
        else if (max == b)
            hue = 60 * ((r - g) / (max - min)) + 240;

        if (hue < 0)
            hue += 360;

        // Saturation
        if (max == 0)
            saturation = 0;
        else
            saturation = 1 - (min / max);

        return [Math.round(hue), Math.round(saturation * 100), Math.round(value * 100)];
    }
}