
d3colors = {
    colorBlend: function(col1, col2, blend) {
        return [ Math.round(col1[0] + (col2[0] - col1[0]) * blend),
                Math.round(col1[1] + (col2[1] - col1[1]) * blend),
                Math.round(col1[2] + (col2[2] - col1[2]) * blend),
                col1[3] + (col2[3] - col1[3]) * blend ];
    },

    rgba: function(col) {
        var r = col[0] > 256 ? 256 : Math.floor(col[0]);
        var g = col[1] > 256 ? 256 : Math.floor(col[1]);
        var b = col[2] > 256 ? 256 : Math.floor(col[2]);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
                // IE FIX + col[3] + ')';
    },

    getAverageColor: function(colors) {
        if (!colors || colors.length == 0)
            return null;


        if (colors.length == 1)
            return colors[0];

        var totalR = 0, totalG = 0, totalB = 0;
        for ( var i = 0; i < colors.length; i++) {
            totalR += colors[i][0];
            totalG += colors[i][1];
            totalB += colors[i][2];
        }

        return [ totalR / colors.length, totalG / colors.length,
                totalB / colors.length, 1 ];
    },

    getRgbaFromHex: function(hexColor) {
        return [
                parseInt(this.cutHex(hexColor).substring(0, 2), 16),
                parseInt(this.cutHex(hexColor).substring(2, 4), 16),
                parseInt(this.cutHex(hexColor).substring(4, 6), 16),
                1 ];
    },

    cutHex: function(h) {
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

        var match = text.match(/\d+/g);
        if(match && match.length >= 3)
            return [ parseInt(match[0]), parseInt(match[1]), parseInt(match[2]), 1 ];
    },

    getDarkerColorHex: function(hex, val) {
        var color = this.getRgbaFromHex(hex);
        var r = color[0] * (val||.5);
        var g = color[1] * (val||.5);
        var b = color[2] * (val||.5);

        return this.getHexFromRgb(r, g, b);
    },

    getLighterColorHex: function(hex, val) {
        var color = this.getRgbaFromHex(hex);
        var r = color[0] + (255 - color[0]) * (val||.5);
        var g = color[1] + (255 - color[1]) * (val||.5);
        var b = color[2] + (255 - color[2]) * (val||.5);

        return this.getHexFromRgb(r, g, b);
    },

    getColorByIndex: function(index, length) {
        if(index < 0)
            return '#666666';

        var i = index * 255 / length;
        var r = Math.round(Math.sin(0.024 * i) * 127 + 128);
        var g = Math.round(Math.sin(0.024 * i + 2) * 127 + 128);
        var b = Math.round(Math.sin(0.024 * i + 4) * 127 + 128);

        // and return a color matching that ratio along the full spectrum
        return this.getHexFromRgb(r, g, b);
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