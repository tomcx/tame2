/*!
 * TAME [TwinCAT ADS Made Easy] V2.2.2
 * 
 * Copyright (c) 2009-2012 Thomas Schmidt; t.schmidt.p1 at freenet.de
 * 
 * Dual licensed under:
 *  MIT - http://www.opensource.org/licenses/mit-license
 *  GPLv3 - http://www.opensource.org/licenses/GPL-3.0
 * 
 */


/**
 * This is the global TAME object. Used as a namespace to store values and functions.
 */
var TAME = { 
    //Names of days and months. This is for the formatted output of date values. You can
    //simply add your own values if you need.
    weekdShortNames: {
        ge: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
        en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    },
    weekdLongNames: {
        ge: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
        en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    monthsShortNames: {
        ge: ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dez']
    },
    monthsLongNames: {
        ge: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
        en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    }
};


/**
 * The constructor function for the Web Service Client.
 * 
 * @param {Object} service  Contains the paramters of the Web Service.
 */
TAME.WebServiceClient = function(service) {
    
    //======================================================================================
    //                                    Properties
    //======================================================================================
    
    //Set language specific names of days and months, default is german.
    var lang = (typeof service.language == 'string') ? service.language : 'ge';
    this.dateNames = {
        weekdShort: TAME.weekdShortNames[lang],
        weekdLong: TAME.weekdLongNames[lang],
        monthsShort: TAME.monthsShortNames[lang],
        monthsLong: TAME.monthsLongNames[lang]
    };
    
    //Maximum string length.
    this.maxStringLen = 255;
        
    //Maximum count of dropped requests after a request
    //was not acknowledged (in conjunction with a reqest ID).
    this.maxDropReq = 10;
    
    //Check limits of numeric variables before sending them to the PLC
    this.useCheckBounds = true;


    //======================================================================================
    //                                     Variables
    //======================================================================================

    var instance = this,
    
        //Index-Group's
        fields = {
            M: '16416',    //PLC memory range(%M field), READ_M - WRITE_M
            MX: '16417',   //PLC memory range(%MX field), READ_MX - WRITE_MX
            I: '61472',    //PLC process diagram of the physical inputs(%I field), READ_I - WRITE_I
            IX: '61473',   //PLC process diagram of the physical inputs(%IX field), READ_IX - WRITE_IX
            Q: '61488',    //PLC process diagram of the physical outputs(%Q field), READ_Q - WRITE_Q
            QX: '61489'    //PLC process diagram of the physical outputs(%QX field), READ_QX - WRITE_QX
        },
        
        //Lenght of PLC data types in byte.
        plcTypeLen = {
            BOOL: 1,
            BYTE: 1,
            USINT: 1,
            SINT: 1,
            WORD: 2,
            UINT: 2,
            INT: 2,
            INT1DP: 2,
            DWORD: 4,
            UDINT: 4,
            DINT: 4,
            TIME: 4,      //time base in PLC: milliseconds
            TOD: 4,       //time base in PLC: milliseconds
            DATE: 4,      //time base in PLC: seconds
            DT: 4,        //time base in PLC: seconds
            REAL: 4,
            LREAL: 8,
            STRING: 80,    //without termination
            EndStruct: 0   //should be 0!
        },
        
        //Generate a Base64 alphabet for the encoder. Using an array or object to
        //store the alphabet the en-/decoder runs faster than with the commonly
        //used string. At least with the browsers of 2009. ;-)
        b64Enc = function() {
            var ret = {},
                str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            for (var i = 0; i < str.length; i++) {
                ret[i] = str.charAt(i);
            }
            return ret;
        }(),
        
        //Generate a Base64 alphabet for the decoder.
        b64Dec = function() {
            var ret = {},
                str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
            for (var i = 0; i < str.length; i++) {
                ret[str.charAt(i)] = i; 
            }
            return ret;
        }(),
        
        //4-byte data alignment, for a x86 set it to false, for a ARM to true
        dataAlign4 = service.dataAlign4,
        
        //Array for the request acknowledgement counter.
        currReq = [0],
        
        url,
        netId,
        port;

    
    //URL of the TcAdsWebService.dll
    if (typeof service.serviceUrl == 'string') {
        url = service.serviceUrl;
    } else {
        try {
            console.log('TAME library error: Service URL is not a string!');
        } catch(e) {}
        return;
    }

    //AMS NetID of the PLC
    if (typeof service.amsNetId == 'string') {
        netId = service.amsNetId;
    } else {
        try {
            console.log('TAME library error: NetId is not a string!');
        } catch(e) {}
        return;
    }
    
    //AMS Port Number of the Runtime System
    if (service.amsPort === undefined) {
        port = '801';
    } else if (typeof service.amsPort == 'string' && parseInt(service.amsPort, 10) >= 801 && parseInt(service.amsPort, 10) <= 804) {
       port = service.amsPort;
    } else {
        try {
            console.log('TAME library error: AMS Port Number (' + parseInt(service.amsPort, 10) + ') is no string or out of range!');
        } catch(e) {}
        return;
    }
    
        
    //======================================================================================
    //                                  Encoder Functions
    //======================================================================================

    /**
     * Conversion of ASCII(0-9, a-f, A-F) charcodes to numbers 0-15
     * 
     * @param {Number} charcode
     */
    function charcodeToDual(charcode) {
        if ((charcode >= 0x61) && (charcode <= 0x66)) {
            return (charcode - 0x57);  //a-f
        }
        if ((charcode >= 0x41) && (charcode <= 0x46)) {
            return (charcode - 0x37);  //A-F
        }
        if ((charcode >= 0x30) && (charcode <= 0x39)) {
            return (charcode - 0x30);  //0-9
        }
        return 0;
    }

    /**
     * Convert a number into an array of bytes.
     * 
     * @param {Number} value
     * @param {Number} varlen
     */
    function numToByteArr(value, varlen) {
        var bytes = [],
            hex = value.toString(16);

        while (hex.length < varlen * 2) {
            hex = '0' + hex;
        }
        
        for (var i = 0; i < varlen; i++) {
            bytes[(varlen - 1) - i] = 
                ((charcodeToDual(hex.charCodeAt(i * 2)) * 16) + 
                  charcodeToDual(hex.charCodeAt((i * 2) + 1)));
        }
        return bytes;
    }
    
     /**
      * Convert a JavaScript floating point number to a PLC REAL value.
      * 
      * @param {Number} num
      */
     function floatToReal(num) {

        var mant = 0,
            real = 0,
            bas, abs, tmp, exp;
        
        abs = Math.abs(num);
        
        if (num !== 0) {
            //Find exponent and base.
            for (var i = 128; i > -127; i--) {
                tmp = abs / Math.pow(2, i);
                if (tmp >= 2) {
                    break;
                }
                exp = i;
                bas = tmp;
            }
            exp += 127;
            bas = bas.toString(2);        
            //Create the mantissa.
            for (i = 2; i < 25; i++) {
                mant <<= 1;
                if (bas.charAt(i) == '1') {
                    mant += 1;
                }
            }
            if (bas.charAt(25) == '1') {
                mant += 1;
            }
            //Create the REAL value.
            real = exp; //exponent
            real <<= 23;
            real += mant; //mantissa
            if (num < 0) {
                //Create negative sign.
                real += 2147483648;
            }          
        }
        return real;
    }
    
    /**
      * Convert a JavaScript floating point number to a PLC LREAL value.
      * Cause it's a 64 bit value, we have to split it in two 32 bit integer.
      * 
      * @param {Number} num
      */
     function floatToLreal(num) {
        var mant = 0,
            mant2 = 0,
            lreal = {
                part1: 0,
                part2: 0
            },
            abs, tmp, exp, firstbit, bas;
             
        abs = Math.abs(num);
        
        if (num !== 0) {          
            //Find exponent and base.
            for (var i = 1024; i >= -1023; i--) {
                tmp = abs / Math.pow(2, i);
                if (tmp >= 2) {
                    break;
                }
                exp = i;
                bas = tmp;
            }
            exp += 1023;
            bas = bas.toString(2); 
            //Create the mantissa.
            for (i = 2; i < 22; i++) {
                mant <<= 1;
                if (bas.charAt(i) == '1') {
                    mant += 1;
                }
            }
            if (bas.charAt(i) == '1') {
                firstbit = true;
            }
            i++;
            for (i; i < 54; i++) {
                mant2 <<= 1;
                if (bas.charAt(i) == '1') {
                    mant2 += 1;
                }
            } 
            //Create the LREAL value.
            lreal.part1 = exp; //exponent
            lreal.part1 <<= 20;
            lreal.part1 += mant; //mantissa
            if (num < 0) {
                //Create negative sign.
                lreal.part1 += 2147483648;
            }
            lreal.part2 = mant2;
            if (firstbit === true) {
                lreal.part2 += 2147483648;
            }
        }
        return lreal;
    }
    
    /**
     * Convert a value to value in milliseconds, depending
     * on the format string.
     * 
     * @param {Number} time
     * @param {String} format
     */
    function toMillisec(time, format) {
        var tmp;
        switch (format) {
            case '#d':
            case '#dd':
                tmp = time * 86400000;//days
                break;
            case '#h':
            case '#hh':
                tmp = time * 3600000; //hours
                break;
            case '#m':
            case '#mm':
                tmp = time * 60000;   //minutes
                break;
            case '#s':
            case '#ss':
                tmp = time * 1000;    //seconds
                break;
            case '#ms':
            case '#msmsms':           //milliseconds
                tmp = time;
                break;
            default:
                tmp = time;
                break;
        }
        return tmp;
    }
    
    /**
     * Base64 encoder
     * 
     * @param {Array} data
     */
    function encodeBase64(data) {
        var $ = b64Enc,
            i = 0,
            out = '',
            c1, c2, c3;
        
        while (i < data.length) {
            c1 = data[i++];
            c2 = data[i++];
            c3 = data[i++];
            out = out +
            $[c1 >> 2] +
            $[((c1 & 3) << 4) | (c2 >> 4)] +
            (isNaN(c2) ? '=' : $[(((c2 & 15) << 2) | (c3 >> 6))]) +
            ((isNaN(c2) || isNaN(c3)) ? '=' : $[c3 & 63]);
        }
        return out;
    }
    

    //======================================================================================
    //                                  Decoder Functions
    //======================================================================================

    /**
     * Convert data string to USINT/BYTE.
     * 
     * @param {String} string
     */
    function parsePlcUsint(string) {
        var hexs = numToHexString(string.charCodeAt(0));
        return parseInt(hexs, 16);
    }

    /**
     * Convert data string to SINT.
     * 
     * @param {String} string
     */
    function parsePlcSint(string) {
        var dec = parsePlcUsint(string);
        if (dec > 127) {
            dec = dec - 256;
        }
        return dec;
    }

    /**
     * Convert data string to UINT/WORD.
     * 
     * @param {String} string
     */
    function parsePlcUint(string) {
        var hexs = numToHexString(string.charCodeAt(1));
        hexs +=    numToHexString(string.charCodeAt(0));
        return parseInt(hexs, 16);
    }

    /**
     * Convert data string to INT.
     * 
     * @param {String} string
     */
    function parsePlcInt(string) {
        var dec = parsePlcUint(string);
        if (dec > 32767) {
            dec = dec - 65536;
        }
        return dec;
    }

    /**
     * Convert data string to UDINT/DWORD.
     * 
     * @param {String} string
     */
    function parsePlcUdint(string) {
        var hexs = numToHexString(string.charCodeAt(3)); 
        hexs +=    numToHexString(string.charCodeAt(2));
        hexs +=    numToHexString(string.charCodeAt(1));
        hexs +=    numToHexString(string.charCodeAt(0));
        return parseInt(hexs, 16);
    }

    /**
     * Convert data string to DINT.
     * 
     * @param {String} string
     */
    function parsePlcDint(string) {
        var dec = parsePlcUdint(string);
        if (dec > 2147483647) {
            dec = dec - 4294967296;
        }
        return dec;
    }
    
    /**
     * Convert data string to a formatted time string
     * 
     * @param {String} string
     * @param {String} format
     */
    function parsePlcTime(string, format) {
        var time = parsePlcUdint(string);
        if (format === undefined) {
            return time;    //Unformatted: value in milliseconds.
        } else {
            return (timeToString(time, format));
        }
    }
    
    /**
     * Convert data string to a formatted time of day string.
     * 
     * @param {String} string
     * @param {String} format
     */
    function parsePlcTod(string, format) {
        //Create a date object (time base in the PLC are milliseconds)
        var time = new Date(parsePlcUdint(string));
        
        //Time zone correction.
        time = new Date(time.getTime() + time.getTimezoneOffset() * 60000);
        
        if (format === undefined) {
            return time;
        } else {
            return (dateToString(time, format));
        }
    }
    
     /**
      * Convert data string to a formatted date/time of day string.
      * 
      * @param {String} string
      * @param {String} format
      */
    function parsePlcDate(string, format) {
        //Converte to milliseconds an create a date object
        //(time base of DATE/DT variables in the PLC are seconds since 1.1.1970)
        var date = new Date(parsePlcUdint(string) * 1000);
        
        //Time zone correction.
        date = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
        
        if (format === undefined) {
            return date;
        } else {
            return (dateToString(date, format));
        }
    }

    /**
     * Convert data string of a REAL variable
     * to a JavaScript floating point number.
     * 
     * @param {String} string
     */
    function parsePlcReal(string) {
        var mant = 1, 
            dual = 0.5,
            num = parsePlcUdint(string),
            sign, exp;
        
        //Return if value is zero. 
        if (num === 0) {
            return 0;
        }       
        //Check the sign bit.
        sign = ((num >>> 31) == 1) ? '-' : '+';
        num <<= 1; //Delete the sign bit.
        //Calculate the exponent.
        exp = (num >>> 24) - 127;
        //Calculate the 23 bit mantissa: Shift bits to left and evaluate them.
        num <<= 8;
        for (var i = 1; i <= 23; i++) {
            mant += num < 0 ? dual : 0; //Add if left (sign bit) bit is true.
            num <<= 1;
            dual /= 2;
        }
        return parseFloat(sign + (mant * Math.pow(2, exp)));
    }
    
    /**
     * Convert data string of a LREAL variable
     * to a JavaScript floating point number.
     * 
     * @param {String} string
     */
    function parsePlcLreal(string) {
        var num = parsePlcUdint(string.substring(4,8)),
            num2 = parsePlcUdint(string.substring(0,4)),
            i = 12,
            mant = 1,
            dual = 0.5,
            sign, exp;
            
        //Return if value is zero. 
        if (num === 0 && num2 === 0) {
            return 0;
        }
        //Check the sign bit.
        sign = ((num >>> 31) == 1) ? '-' : '+';
        num <<= 1; //Delete the sign bit.
        //Calculate the exponent.
        exp = (num >>> 21) - 1023;
        //Calculate the mantissa. Shift bits to left and evaluate them.
        //Part 1.
        num <<= 11;
        while (i < 32) {
            mant += num < 0 ? dual : 0; //Add if left (sign bit) bit is true.
            num <<= 1;
            dual /= 2;
            i++;
        }
        //Part 2.
        if ((num2 >>> 31) == 1) {
            mant += dual;
            num2 <<= 1;
            dual /= 2;
        }
        while (i < 64) {
            mant += num2 < 0 ? dual : 0; //Add if left (sign bit) bit is true.
            num2 <<= 1;
            dual /= 2;
            i++;
        }
        return parseFloat(sign + (mant * Math.pow(2, exp)));
    }


    /**
     * Convert data string to string by simply cutting of superfluous characters.
     * 
     * @param {String} string
     */
     function parsePlcString(string) {
        var len = string.length;
        for (var i = 0; i < len; i++) {
            if (string.charCodeAt(i) === 0) {
                break;
            }
        }
        return string.substr(0, i);
    }

    /**
     * Convert a number to a hex string.
     * 
     * @param {Number} value
     */
    function numToHexString(value) {
        var ret = value.toString(16);
        if ((ret.length % 2) !== 0) {
            ret = '0' + ret;
        }
        return ret;
    }
    
    /**
     * Set a fixed length of an integer by adding leading 
     * zeros(i.e. change 2 to 02).
     * 
     * @param {Number} numb
     * @param {Number} places
     */
    function fixNumbLength(numb, places) {
        places = (isNaN(places)) ? 0 : places;
        var str = numb.toString(10);
        while (str.length < places) {
            str = '0' + str;
        } 
        return str;
    }
    
    /**
     * Convert a date object to a formatted string.
     * 
     * @param {Date} time
     * @param {String} format
     */
    function dateToString(time, format) {
        
        var arr = format.split('#'),
            arrlen = arr.length,
            tstring = '',
            tmp;
            
        for (var i = 1; i < arrlen; i++) {
            
            switch (arr[i]) {
                //Date formatting.
                case 'D':  
                    tmp = time.getDate();
                    break;
                case 'DD':
                    tmp = time.getDate();
                    tmp = fixNumbLength(tmp, 2);
                    break;
                case 'WD':
                    tmp = time.getDay();
                    break;
                case 'WKD':
                    tmp = instance.dateNames.weekdShort[time.getDay()];
                    break;
                case 'WEEKDAY':
                    tmp = instance.dateNames.weekdLong[time.getDay()];
                    break;
                case 'M':
                    tmp = time.getMonth() + 1;
                    break;
                case 'MM':
                    tmp = time.getMonth() + 1;
                    tmp = fixNumbLength(tmp, 2);
                    break;
                case 'MON':
                    tmp = instance.dateNames.monthsShort[time.getMonth()];
                    break;
                case 'MONTH':
                    tmp = instance.dateNames.monthsLong[time.getMonth()];
                    break;
                case 'YY':
                    tmp = time.getYear();
                    while (tmp > 100) {
                        tmp -= 100;
                    }
                    break;
                case 'YYYY':
                    tmp = time.getFullYear();
                    break;
                    
                //Time formatting.
                case 'h':
                    tmp = time.getHours();
                    break;
                case 'hh':
                    tmp = time.getHours();
                    tmp = fixNumbLength(tmp, 2);
                    break;
                case 'm':
                    tmp = time.getMinutes();
                    break;
                case 'mm':
                    tmp = time.getMinutes();
                    tmp = fixNumbLength(tmp, 2);
                    break;
                case 's':
                    tmp = time.getSeconds();
                    break;
                case 'ss':
                    tmp = time.getSeconds();
                    tmp = fixNumbLength(tmp, 2);
                    break;
                case 'ms':
                    tmp = time.getMilliseconds();
                    break;
                case 'msmsms':
                    tmp = time.getMilliseconds();
                    tmp = fixNumbLength(tmp, 3);
                    break;
                default:
                    tmp = arr[i];
                    break;
            }
            tstring = tstring + tmp;     
        }
        return tstring;
    }
    
    /**
     * Convert a number with a value in milliseconds to a formatted string.
     * 
     * @param {Number} time
     * @param {String} format
     */
    function timeToString(time, format) {
        var arr = format.split('#'),
            arrlen = arr.length,
            tstring = '',
            tmp;
            
        for (var i = 1; i < arrlen; i++) {
            
            switch (arr[i]) {
                case 'd':
                    if (arrlen <= 2) {
                        tmp = time / 86400000;
                    } else {
                        tmp = Math.floor(time / 86400000);
                        time = time % 86400000;
                    }
                    break;
                case 'dd':
                    if (arrlen <= 2) {
                        tmp = time / 86400000;
                    } else {
                        tmp = Math.floor(time / 86400000);
                        time = time % 86400000;
                    }
                    tmp = fixNumbLength(tmp, 2);
                    break;
                case 'h':
                    if (arrlen <= 2) {
                        tmp = time / 3600000;
                    } else {
                        tmp = Math.floor(time / 3600000);
                        time = time % 3600000;
                    }
                    break;
                case 'hh':
                    if (arrlen <= 2) {
                        tmp = time / 3600000;
                    } else {
                        tmp = Math.floor(time / 3600000);
                        time = time % 3600000;
                    }
                    tmp = fixNumbLength(tmp, 2);
                    break;
                case 'm':
                    if (arrlen <= 2) {
                        tmp = time / 60000;
                    } else {
                        tmp = Math.floor(time / 60000);
                        time = time % 60000;
                    }
                    break;
                case 'mm':
                    if (arrlen <= 2) {
                        tmp = time / 60000;
                    } else {
                        tmp = Math.floor(time / 60000);
                        time = time % 60000;
                    }
                    tmp = fixNumbLength(tmp, 2);
                    break;
                case 's':
                    if (arrlen <= 2) {
                        tmp = time / 1000;
                    } else {
                        tmp = Math.floor(time / 1000);
                        time = time % 1000;
                    }
                    break;
                case 'ss':
                    if (arrlen <= 2) {
                        tmp = time / 1000;
                    } else {
                        tmp = Math.floor(time / 1000);
                        time = time % 1000;
                    }
                    tmp = fixNumbLength(tmp, 2);
                    break;
                case 'ms':
                    tmp = time;
                    break;
                case 'msmsms':
                    tmp = time;
                    tmp = fixNumbLength(tmp, 3);
                    break;
                default:
                    tmp = arr[i];
                    break;
            }
            tstring = tstring + tmp;
        }
        return tstring;
    }
    
    /**
     * Base64 decoder
     * 
     * @param {String} data
     */
    function decodeBase64(data) {
        var $ = b64Dec,
            i = 0,
            output = '',
            c1, c2, c3,
            e1, e2, e3, e4;
        
        //Cut all characters but A-Z, a-z, 0-9, +, /, or =
        data = data.replace(/[^A-Za-z0-9\+\/\=]/g, '');
        
        do {
            e1 = $[data.charAt(i++)];
            e2 = $[data.charAt(i++)];
            e3 = $[data.charAt(i++)];
            e4 = $[data.charAt(i++)];
            
            c1 = (e1 << 2) | (e2 >> 4);
            c2 = ((e2 & 15) << 4) | (e3 >> 2);
            c3 = ((e3 & 3) << 6) | e4;
            
            output += String.fromCharCode(c1);
            if (e3 != 64) {
                output += String.fromCharCode(c2);
            }
            if (e4 != 64) {
                output += String.fromCharCode(c3);
            }
        }
        while (i < data.length);
        
        return output;
    }

    
    //======================================================================================
    //                                  Helper Functions
    //======================================================================================
    
    /**
     * Decode variable names passed as strings and return the object,
     * store data values if they are passed too.
     * 
     * @param {String} name     The name of a JavaScript variable or a property.
     * @param {Object} data     Data values to store in the variable/property.
     * @param {Object} obj      The object containing the property to store the data in. 
     *                          Used with createArrayDescriptor and createStructDescriptor 
     *                          for better performance.
     */
    function parseVarName(name, data, obj, prefix, suffix){
        
        var  arr = [],
             last = 0,
             a = [],
             i = 0;
    
        if (typeof name == 'number') {
            arr[0] = name.toString(10);
        } else if (typeof name == 'string') {
            arr = name.split('.');
        } else {
            try {
                console.log('TAME library error: Can\'t parse name of object/variable. Name is not a string or number!');
                console.log(name);
            } catch(e){}
            return;
        }

        if (obj === undefined){
            obj = window;
        }
        last = arr.length - 1;
        
        //Walk through the tiers
        while (i < last) {
             //Check if the passed name points to an array.
            if (arr[i].charAt(arr[i].length - 1) == ']') {
                a = arr[i].substring(0,arr[i].length - 1).split('[');
                obj = obj[a[0]][a[1]];
            } else {
                obj = obj[arr[i]];
            }
            i++;
        } 
        
        //Last element
        if (arr[i].charAt(arr[i].length - 1) == ']') {
            //If last item of the name is an array
            a = arr[i].substring(0, arr[i].length - 1).split('[');
            obj = obj[a[0]];
            //Store data if passed.
            if (data !== undefined) {
                if (typeof prefix == 'string') {
                    data = prefix + data;
                }
                if (typeof suffix == 'string') {
                    data = data + suffix;
                }
                obj[a[1]] = data;
            }
            return obj[a[1]];
            
        } else {
            //Store data if passed.
            if (data !== undefined) {
                if (typeof prefix == 'string') {
                    data = prefix + data;
                }
                if (typeof suffix == 'string') {
                    data = data + suffix;
                }
                obj[arr[i]] = data;
            }
            return obj[arr[i]];
        }      
    }
    
    /**
     * Check if a passed string length is valid.
     * 
     * @param {Number} len
     */
    function isValidStringLen(len) {
        if (len === undefined) {
            return false;
        } else if (! isNaN(len) && len > 0 && len <= instance.maxStringLen) {
            return true;
        } else {
            try {
                console.log('TAME library error: User defined string length not valid! length: ' + len);
                console.log('Max. string length: ' + instance.maxStringLen);
            } catch(e){}
            return false;
        } 
    }
    
    /**
     * Process the given address of the descriptor.
     * 
     * @param {Object} descr    A request descriptor.
     */
    function processReqAddr(descr) {
        
        var addr = '', mxaddr = [];
        
        if (typeof descr.fld != 'string') {
            //New addressing style with V2.0
            if (typeof descr.addr == 'string' && descr.addr.charAt(0) == '%') {
                if (descr.addr.charAt(2) == 'X') {
                    descr.fld = descr.addr.substr(1, 2);
                    addr = descr.addr.substr(3);
                    mxaddr = addr.split('.');
                    descr.addr = mxaddr[0] * 8 + mxaddr[1] * 1;
                } else {
                    descr.fld = descr.addr.substr(1, 1);
                    descr.addr = parseInt(descr.addr.substr(3), 10);
                }
            } else {
                try {
                    console.log('TAME library error: No field defined (M,MX,I,IX,Q,QX) and address contains no field information (%MB,%MX,%IB,%IX%,%QB,%QX).');
                    console.log('fld:' + descr.fld);
                    console.log('addr:' + descr.addr);
                } catch (e) {}
                return;
            }
        } else if (descr.fld.charAt(0) === 'M' || descr.fld.charAt(0) === 'I' || descr.fld.charAt(0) === 'Q') {
            //Old school adressing
            if (typeof descr.addr == 'string') {
                //Konvert to number if accidentally defined as string
                descr.addr = parseFloat(descr.addr);
            } else if (typeof descr.addr !== 'number') {
                try {
                    console.log('TAME library error: No PLC variable address defined.');
                    console.log('addr:' + descr.addr);
                } catch (e) {}
                return;
            }
            if (descr.fld.length == 2 && descr.fld.charAt(1) == 'X') {
                if (descr.addr === 0) {
                    descr.addr = '0.0'; //Workaround cause 0.0 is passed as 0.
                }
                mxaddr = descr.addr.toString().split('.');
                descr.addr = mxaddr[0] * 8 + mxaddr[1] * 1;
            }
        } else {
            try {
                console.log('TAME library error: Field not defined (should be M,MX,I,IX,Q,QX) and address contains no correct field definition.');
                console.log('fld:' + descr.fld);
                console.log('addr:' + descr.addr);
            } catch (e) {}
        }
                
        if (isNaN(descr.addr)) {
             try {
                console.log('TAME library error: Wrong address definition.');
                console.log('addr:' + descr.addr);
            } catch (e) {}
        }
    }
    
    /**
     * Create the objects for SOAP and XMLHttpRequest and send the request.
     * 
     * @param {Object} adsReq   The object containing the arguments of the ADS request.
     */
    function asyncRequest(adsReq) {
        
        adsReq.send = function() {
            
            var soapReq = {};

            //Cancel the request, if the last on with the same ID is not finished.
            if (typeof adsReq.id == 'number' && currReq[adsReq.id] > 0) {
                try {
                    console.log('TAME library warning: Request dropped (last request with ID ' + adsReq.id + ' not finished!)');
                } catch(e) {}
                currReq[this.id]++;
                if (currReq[this.id] <= instance.maxDropReq) {
                    return;
                }
                //Automatic acknowleding after a count of 'maxDropReq' to
                //prevent stucking.
                currReq[this.id] = 0;
            }
                
            //Create the XMLHttpRequest object.
            //Mozilla, Opera, Safari and Internet Explorer (> v7)
            if (XMLHttpRequest !== undefined) {
                this.xmlHttpReq = new XMLHttpRequest();
            }
            //Internet Explorer 6 and older
            if (! this.xmlHttpReq) {
                try {
                    this.xmlHttpReq = new ActiveXObject('Msxml2.XMLHTTP');
                } catch(e) {
                    try {
                        this.xmlHttpReq = new ActiveXObject('Microsoft.XMLHTTP');
                    } catch(e) {
                        this.xmlHttpReq = null;
                        try {
                            console.log('TAME library error: Failed Creating XMLHttpRequest-Object!');
                        } catch(e){}
                    }
                }
            }

            //Generate the SOAP request.
            soapReq = '<?xml version=\'1.0\' encoding=\'utf-8\'?>';
            soapReq += '<soap:Envelope xmlns:xsi=\'http://www.w3.org/2001/XMLSchema-instance\' xmlns:xsd=\'http://www.w3.org/2001/XMLSchema\' xmlns:soap=\'http://schemas.xmlsoap.org/soap/envelope/\'>';
            soapReq += '<soap:Body><q1:';
            soapReq += this.method;
            soapReq += ' xmlns:q1=\'http://beckhoff.org/message/\'><netId xsi:type=\'xsd:string\'>';
            soapReq += netId;
            soapReq += '</netId><nPort xsi:type=\'xsd:int\'>';
            soapReq += port;
            soapReq += '</nPort><indexGroup xsi:type=\'xsd:unsignedInt\'>';
            soapReq += this.indexGroup;
            soapReq += '</indexGroup><indexOffset xsi:type=\'xsd:unsignedInt\'>';
            soapReq += this.indexOffset;
            soapReq += '</indexOffset>';
    
            if (this.cbRdLen > 0) {
                soapReq += '<cbRdLen xsi:type=\'xsd:int\'>';
                soapReq += this.cbRdLen;
                soapReq += '</cbRdLen>';
            }
            if (this.pData && this.pData.length > 0) {
                soapReq += '<pData>';
                soapReq += this.pData;
                soapReq += '</pData>';
            }
            soapReq += '</q1:';
            soapReq += this.method;
            soapReq += '></soap:Body></soap:Envelope>';
            
            //Send the AJAX request.
            if (typeof this.xmlHttpReq == 'object') {
    
                this.xmlHttpReq.open('POST', url, true);
    
                this.xmlHttpReq.setRequestHeader('SOAPAction', 'http://beckhoff.org/action/TcAdsSync.' + this.method);
                this.xmlHttpReq.setRequestHeader('Content-Type', 'text/xml; charset=utf-8');
    
                this.xmlHttpReq.onreadystatechange = function() {
                    if ((adsReq.xmlHttpReq.readyState == 4) && (adsReq.xmlHttpReq.status == 200)) {
                        instance.parseData(adsReq);
                    }
                };
                
                this.xmlHttpReq.send(soapReq);
    
                //Request with index 'id' sent.
                if (typeof this.id == 'number') {
                    currReq[this.id] = 1;
                }
            }
        };
        return adsReq;
    }
    
    /**
     * Function for checking the input values when writing numeric PLC variables.
     * 
     * @param {Object} item
     * @param {String} type
     * @param {Number} min
     * @param {Number} max
     */
    function checkValue(item, type, min, max){
        var val;
        
        //Test if value is valid.
        if (typeof item.val == 'string') {
            if (type === 'REAL' || type === 'LREAL') {
                val = parseFloat(item.val);
            } else {
                val = parseInt(item.val, 10);
            }
        } else if (typeof item.val == 'number') {
            val = item.val;
        } else {
            try {
                console.log('TAME library error: Wrong variable type for a numeric variable in write request!');
                console.log('TAME library error: Variable type should be number or string, but is ' + typeof item.val);
                console.log(item);
            } catch (e) {}
            val = 0;
        }
        
        if (isNaN(val)) {
            val = 0;
            try {
                console.log('TAME library error: Value of a numeric variable in write request is not a number.');
                console.log(item);
            } catch (e) {}
        }
        
        //Check bounds
        if (instance.useCheckBounds === true) {
            if (type === 'LREAL') {
                if (!isFinite(val)) {
                    try {
                        console.log('TAME library warning: Limit for LREAL value exceeded!');
                        console.log('Upper limit: ' + Number.MAX_VALUE);
                        console.log('Lower limit: ' + Number.MIN_VALUE);
                        console.log('value: ' + val);
                        console.log(item);
                    } catch (e) {}
                }
            } else if (type === 'REAL') {
                if (val > 0) {
                    if (val < 1.175495e-38) {  
                        try {
                            console.log('TAME library warning: Lower limit for positive REAL value exceeded!');
                            console.log('limit: 1.175495e-38');
                            console.log('value: ' + val);
                            console.log(item);
                        } catch (e) {}
                        val = 1.175495e-38;
                    } else if (val > 3.402823e+38) {
                        try {
                            console.log('TAME library warning: Upper limit for positive REAL value exceeded!');
                            console.log('limit: 3.402823e+38');
                            console.log('value: ' + val);
                            console.log(item);
                        } catch (e) {}
                        val = 3.402823e+38;
                    }
                } else if (val < 0) {
                    if (val > -1.175495e-38) {                   
                        try {
                            console.log('TAME library warning: Upper limit for negative REAL value exceeded!');
                            console.log('limit: -1.175495e-38');
                            console.log('value: ' + val);
                            console.log(item);
                        } catch (e) {}
                        val = -1.175495e-38;
                    } else if (val < -3.402823e+38) {
                        try {
                            console.log('TAME library warning: Lower limit for negative REAL value exceeded!');
                            console.log('limit: -3.402823e+38');
                            console.log('value: ' + val);
                            console.log(item);
                        } catch (e) {}
                        val = -3.402823e+38;
                    }
                }
            } else {
                if (val < min) {
                    try {
                        console.log('TAME library warning: Lower limit for numeric value exceeded!');
                        console.log('type: ' + type);
                        console.log('limit: ' + min);
                        console.log('value: ' + val);
                        console.log(item);
                    } catch (e) {}
                    val = min;
                }
                else if (val > max) {
                    try {
                        console.log('TAME library warning: Upper limit for numeric value exceeded!');
                        console.log('type: ' + type);
                        console.log('limit: ' + max);
                        console.log('value: ' + val);
                        console.log(item);
                    } catch (e) {}
                    val = max;
                }
            }
        }
        
        return val;
    }
     
    
    //======================================================================================
    //                     Functions for Creating Request Descriptors
    //======================================================================================
    
    /**
     * Create the Request Descriptor for a single variable. An item list
     * with a single array item is generated.
     * 
     * @param {String} method   The method, either "Read" or "Write".
     * @param {String} type     The PLC data type.
     * @param {Object} args     The arguments for building for the Request Descriptor.
     */
    function createSingleDescriptor(method,type,args) {
        
        var reqDescr = {},
            len;

        len = plcTypeLen[type];
        
        switch (type) {
            case 'STRING':
                //Change the read length if a value is given.
                if (isValidStringLen(args.strlen)) {
                    type += '.' + args.strlen;
                    len = args.strlen;
                }
                len++; //Termination
                break;
            case 'TIME':
            case 'TOD':
            case 'DT':
            case 'DATE':
                //Append the format string to the data type.
                if (typeof args.format == 'string') {
                    type += '.' + args.format;
                }
                break;
            case 'REAL':
            case 'LREAL':
                //Append the number of decimal places to the data type.
                if (typeof args.decPlaces  == 'number') {
                    type += '.' + args.decPlaces;
                } else if (typeof args.dp  == 'number') {
                    type += '.' + args.dp;
                }
                break;
        } 
        
        //Create the Request Descriptor.
        reqDescr = {
            fld: args.fld,
            addr: args.addr,
            id: args.id,
            oc: args.oc,
            ocd: args.ocd,
            readLength: len,
            debug: args.debug,
            seq: true,
            items: [{
                val: args.val,
                jvar: args.jvar,
                type: type,
                prefix: args.prefix,
                suffix: args.suffix
            }]
        };

        //Call the send function.
        if (method === 'Write') {
            instance.writeReq(reqDescr);
        } else {
            instance.readReq(reqDescr);
        }
    }

    /**
     * Create a Request Descriptor for an array. An item list of
     * single variables is generated.
     * 
     * @param {String} method   The method, either "Read" or "Write".
     * @param {String} type     The data type of the PLC variable.
     * @param {Object} args     The arguments for building the Request Descriptor.
     */
    function createArrayDescriptor(method,type,args) {
        
        var reqDescr = {},
            dataObj = {},
            arrayLength,
            cnt = 0,
            i = 0,
            j = 0,
            len,
            defArr = [],
            lenArrElem,
            lastDefArr,
            structByteLen = 0,
            strlen,
            vlen,
            vlenMax = 0,
            endPadLen = 0,
            mod,
            elem,
            addr,
            wrtOneOnly;
        
        //Get the object of the stored data, direct with 'val'
        //for a write request or parsing the name if 'jvar' is given.
        if (method === 'Write' && typeof args.val == 'object') {
            dataObj = args.val;
            arrayLength = args.val.length;
        } else if (typeof args.jvar == 'string') {
            dataObj = parseVarName(args.jvar);
            arrayLength = parseVarName(args.jvar).length;
        } else {
            try {
                console.log('TAME library error: No data object for this ' + method + '-Request defined!');
            } catch(e){}
        }
        
        //Override array length if manually set
        if (typeof args.arrlen == 'number') {
            arrayLength = args.arrlen;
        }
        
        //Convert address if necessary
        processReqAddr(args);
        
        //Check if only one item should be written.
        if (typeof args.item == 'number' && !isNaN(args.item) && method === 'Write') {
            wrtOneOnly = true;
            if (args.item < 0 || args.item > arrayLength - 1) {
                try {
                    console.log('TAME library error: Wrong value for "item"!');
                    console.log('item: ' + args.item);
                    console.log('Last array index: ' + (arrayLength - 1));
                } catch(e){}
            }
        }
            
        if (type === 'STRUCT') {
            //---------------------- Array of Structures ---------------------
            //Parse the name of the structure definiton, if it is passed
            //as a string.
            if (typeof args.def == 'string') {
                args.def = parseVarName(args.def);
            } else if (typeof args.def != 'object') {
                try {
                    console.log('TAME library error: No structure definition found!');
                } catch(e){}
            }
            
            //Calculate the length of the structure and the padding bytes
            for (elem in args.def) {
                //Separate data type and length.
                defArr = args.def[elem].split('.');
                
                if (defArr[0] == 'ARRAY') {
                    lenArrElem = parseInt(defArr[1], 10);
                    defArr.shift();
                    defArr.shift();
                } else {
                    lenArrElem = 1;
                }
                
                for (i = 0; i < lenArrElem; i++) {
                    //Set the length of the PLC variable.
                    if (defArr[0] == 'STRING') {
                        if (typeof defArr[1] == 'string') {
                            strlen = parseInt(defArr[1], 10);
                        }
                        vlen = (isValidStringLen(strlen) ? strlen : plcTypeLen[defArr[0]]) + 1;
                    } else {
                        vlen = plcTypeLen[defArr[0]];
                    }
                    
                    //Add the length of the PLC variables
                    if (dataAlign4 === true && vlen > 1 && defArr[0] != 'STRING' && structByteLen > 0) {
                        mod = structByteLen % vlen;
                        if (mod > 0) {
                            structByteLen += vlen - mod;
                        }
                    }
                    structByteLen += vlen; 
                }
                //Store the maximum length of the PLC variables
                //for inserting padding bytes at the end of the structure.
                if (dataAlign4 === true && vlen > vlenMax && defArr[0] != 'STRING') {
                    vlenMax = vlen;
                }
            }
            //Calculate the padding bytes at the end of the structure
            if (dataAlign4 === true && vlenMax > 1 && defArr[0] != 'STRING') {
                if (vlenMax > 4) {
                    vlenMax = 4;
                }
                mod = structByteLen % vlenMax;
                if (mod > 0) {
                    endPadLen = vlenMax - mod;
                    structByteLen += endPadLen;
                }
            }
                
            
            //Write only one item if desired.
            if (wrtOneOnly) {
                //Set the new start addresses and length
                args.addr = args.addr + structByteLen * args.item;
                arrayLength = 1;
            }
            
            reqDescr = {
                fld: args.fld,
                addr: args.addr,
                id: args.id,
                oc: args.oc,
                ocd: args.ocd,
                debug: args.debug,
                readLength: structByteLen * arrayLength,
                seq: true,
                dataAlign4: dataAlign4,
                dataObj: dataObj,
                items: []
            };
            
            //Create the item list.
            //Although jvar isn't necessary for write requests,
            //it's good for easier debugging.
            for (i = 0; i < arrayLength; i++) {
                for (elem in args.def) {
                    defArr = args.def[elem].split('.');
                    
                    if (defArr[0] == 'ARRAY') {
                        lenArrElem = parseInt(defArr[1], 10);
                        lastDefArr = defArr.length - 1;
                        
                        for (j = 0; j < lenArrElem; j++) {
                            if (defArr[lastDefArr] == 'SP') {
                                reqDescr.items[cnt] = {
                                    jvar: i + '.' + elem + j
                                };
                                if (lastDefArr === 4) {
                                    reqDescr.items[cnt].type = defArr[2] + '.' + defArr[3];
                                } else {
                                    reqDescr.items[cnt].type = defArr[2];
                                }
                            } else {
                                reqDescr.items[cnt] = {
                                    jvar: i + '.' + elem + '.' + j
                                };
                                if (lastDefArr === 3) {
                                    reqDescr.items[cnt].type = defArr[2] + '.' + defArr[3];
                                } else {
                                    reqDescr.items[cnt].type = defArr[2];
                                }
                            }
                            
                            if (method === 'Write') {
                                if (wrtOneOnly) {
                                    if (defArr[lastDefArr] == 'SP') {
                                        reqDescr.items[cnt].val = dataObj[args.item][elem + j];
                                    } else {
                                        reqDescr.items[cnt].val = dataObj[args.item][elem][j];
                                    }
                                } else {
                                    if (defArr[lastDefArr] == 'SP') {
                                        reqDescr.items[cnt].val = dataObj[i][elem + j];
                                    } else {
                                        reqDescr.items[cnt].val = dataObj[i][elem][j];
                                    }
                                }
                            }
                            cnt++;
                        }
                    } else {
                        reqDescr.items[cnt] = {
                            jvar: i + '.' + elem,
                            type: args.def[elem]
                        };
                        if (method === 'Write') {
                            if (wrtOneOnly) {
                                reqDescr.items[cnt].val = dataObj[args.item][elem];
                            } else {
                                reqDescr.items[cnt].val = dataObj[i][elem];
                            }
                        }
                        cnt++;
                    }  
                }
                //Set an item as a mark at the end of the structure
                //for inserting padding bytes in "writeReq" and "readReq" later.
                if (dataAlign4 === true) {
                    reqDescr.items[cnt]= {
                        type: 'EndStruct',
                        val: endPadLen
                    };
                    cnt++;
                }
            }
        } else {
            //---------------------- Simple Array -----------------------
            len = plcTypeLen[type];
                      
            switch (type) {
                case 'STRING':
                    //Change the read length if a value is given.
                    if (isValidStringLen(args.strlen)) {
                        type += '.' + args.strlen;
                        len = args.strlen;
                    }
                    len++; //Termination
                    break;
                case 'TIME':
                case 'TOD':
                case 'DT':
                case 'DATE':
                    //Append the format string to the data type.
                    if (typeof args.format == 'string') {
                        type += '.' + args.format;
                    }
                    break;
                case 'REAL':
                case 'LREAL':
                    //Append the number of decimal places to the data type.
                    if (typeof args.decPlaces  == 'number') {
                        type += '.' + args.decPlaces;
                    } 
                    else if (typeof args.dp  == 'number') {
                        type += '.' + args.dp;
                    }
                    break;
            } 
            
            //Set address and array length if only one item should be written.
            if (wrtOneOnly) {
                args.addr += args.item * len;
                arrayLength = 1;
            }
            
            reqDescr = {
                fld: args.fld,
                addr: args.addr,
                id: args.id,
                oc: args.oc,
                ocd: args.ocd,
                readLength: len * arrayLength,
                debug: args.debug,
                seq: true,
                dataObj: dataObj,
                items: []
            };
            
            //Create the item list.
            //Although jvar isn't necessary for write requests,
            //it's good for easier debugging.
            for (i = 0; i < arrayLength; i++) {
                reqDescr.items[i] = {
                    jvar: i,
                    type: type
                };
                if (method === 'Write') {
                    if (wrtOneOnly) {
                        reqDescr.items[i].val = dataObj[args.item];
                    } else {
                        reqDescr.items[i].val = dataObj[i];
                    } 
                }
            }
        }

        //Call the send function.
        if (method === 'Write') {
            instance.writeReq(reqDescr);
        } else {
            instance.readReq(reqDescr);
        }
    }
    
    /**
     * Create a Request Descriptor for a structure,
     * a structure definition has to be passed as one of the arguments,
     * from wich the item list is created.
     * 
     * @param {String} method   The method, either "Read" or "Write".
     * @param {Object} args     The arguments for building the Request Descriptor.
     */
    function createStructDescriptor(method, args)  {
        
        var reqDescr = {},      //Request Descriptor
            dataObj = {},       //object wich holds the data for write requests 
            defArr = [],        //subelements of a structure definition item
            cnt = 0,
            lastDefArr,
            lenArrElem,
            elem,
            j;
        
        //Get the object of the stored data, direct with 'val'
        //for a write request or parsing the name if 'jvar' is given.
        if (method === 'Write' && typeof args.val == 'object') {
            dataObj = args.val;
        } else if (typeof args.jvar == 'string') {
            dataObj = parseVarName(args.jvar);
        } else {
            try {
                console.log('TAME library error: No data object for this ' + method + '-Request defined!');
            } catch(e){}
        }
        
        //Parse the name of the structure definiton, if it is passed
        //as a string.
        if (typeof args.def == 'string') {
            args.def = parseVarName(args.def);
        } else if (typeof args.def != 'object') {
            try {
                console.log('TAME library error: No structure defininition found!');
            } catch(e){}
        }
        
        reqDescr = {
            fld: args.fld,
            addr: args.addr,
            id: args.id,
            oc: args.oc,
            ocd: args.ocd,
            debug: args.debug,
            seq: true,
            dataAlign4: dataAlign4,
            dataObj: dataObj,
            items: []
        };
        
        //Create the item list.
        //Although jvar isn't necessary for write requests,
        //it's good for easier debugging.
        for (elem in args.def) {
            defArr = args.def[elem].split('.');
            
            if (defArr[0] == 'ARRAY') {
                lenArrElem = parseInt(defArr[1], 10);
                lastDefArr = defArr.length - 1;
                for (j = 0; j < lenArrElem; j++) {
                    if (defArr[lastDefArr] == 'SP') {
                        reqDescr.items[cnt] = {
                            jvar: elem + j
                        };
                        if (lastDefArr === 4) {
                            reqDescr.items[cnt].type = defArr[2] + '.' + defArr[3];
                        } else {
                            reqDescr.items[cnt].type = defArr[2];
                        }
                    } else {
                        reqDescr.items[cnt] = {
                            jvar: elem + '.' + j
                        };
                        if (lastDefArr === 3) {
                            reqDescr.items[cnt].type = defArr[2] + '.' + defArr[3];
                        } else {
                            reqDescr.items[cnt].type = defArr[2];
                        }
                    }
                    if (method === 'Write') {
                        if (defArr[lastDefArr] == 'SP') {
                            reqDescr.items[cnt].val = dataObj[elem + j];
                        } else {
                            reqDescr.items[cnt].val = dataObj[elem][j];
                        }
                    }
                    cnt++;
                }
            } else {
                reqDescr.items[cnt] = {
                    jvar: elem,
                    type: args.def[elem]
                };
                if (method === 'Write') {
                    reqDescr.items[cnt].val = dataObj[elem];
                }
                cnt++;
            }
        }
        
        //Call the send function
        if (method === 'Write') {
            instance.writeReq(reqDescr);
        } else {
            instance.readReq(reqDescr);
        }
    }
    
    
    //======================================================================================
    //                                Public Methods
    //======================================================================================
    
    /**
     * This is the function for creating a write request. Depending on the
     * values and PLC data types passed in the variable list a byte array is
     * created and the function for sending the request is called.
     * 
     * @param {Object}  reqDescr    The Request Descriptor. Besides other information
     *                              this object contains the allocation of PLC and
     *                              JavaScript variables in an item list.
     */
    this.writeReq = function(reqDescr) {
        
        var itemList = reqDescr.items,
            adsReq = {},
            pData = [],
            type = [],
            bytes= [],
            listlen, len, strlen, val, pcount, mod, item, sl, i, idx;
        
        //Process the request address
        processReqAddr(reqDescr);
        
        //Debug: Log the Request Descriptor to the console.
        if (reqDescr.debug) {
            try {
                console.log(reqDescr);
            } catch(e) {}
        }
        
        //Run through the elements in the item list.
        for (idx = 0, listlen = itemList.length; idx < listlen; idx++) {

            bytes = [];
            item = itemList[idx];
            
            //Separate type and formatting string.
            if (item.type !== undefined) {
                type = item.type.split('.');
            }
            //Length of the data type.
            //Maximum lenght is limited to 4 (due to structure padding),
            //the lenght of strings is calculated later.
            len = (plcTypeLen[type[0]] < 4) ? plcTypeLen[type[0]] : 4;
            
            //4-byte padding within structures.
            //reqDescr.dataAlign4 is only set in "writeStruct/readStruct" and
            //"writeArrayOfStruct/readArrayOfStruct"
            if (reqDescr.dataAlign4 === true && len > 1 && type[0] != 'STRING' && pData.length > 0) {
                mod = pData.length % len;
                if (mod > 0) {
                    pcount = len - mod;
                    for (i = 1; i <= pcount; i++) {
                        pData.push(0);
                    }
                }
            }
            
            //If no value is passed, set value to zero and log an error message.
            if (item.val === undefined) {
                switch (type[0]) {
                    case 'STRING':
                        item.val = '';
                        break;
                    case 'DATE':
                    case 'DT':
                    case 'TOD':
                        item.val = new Date();
                        break;
                    default:
                        item.val = 0;
                        break;       
                } 
                try {
                    console.log('TAME library warning: Value of a variable in write request is not defined!');
                    console.log(item);
                } catch(e) {}
            }
            
            //Depending on the data type, convert the values to a byte array.
            switch (type[0] ) {
                case 'BOOL':
                    if (item.val) {
                        bytes[0] = 1;
                    } else {
                        bytes[0] = 0;
                    }
                    break;
                case 'BYTE':
                case 'USINT':
                    val = checkValue(item, type[0], 0, 255);
                    bytes = numToByteArr(val, len);
                    break;
                case 'SINT':
                    val = checkValue(item, type[0], -128, 127);
                    if (val < 0) {
                        val = val + 256;
                    }
                    bytes = numToByteArr(val, len);
                    break;
                case 'WORD':
                case 'UINT':                
                    val = checkValue(item, type[0], 0, 65535);
                    bytes = numToByteArr(val, len);
                    break;
                case 'INT':                
                    val = checkValue(item, type[0], -32768, 32767);
                    if (val < 0) {
                        val = val + 65536;
                    }
                    bytes = numToByteArr(val, len);
                    break;
                case 'INT1DP':
                    item.val = Math.round(item.val * 10);
                    val = checkValue(item, type[0], -32768, 32767);
                    if (val < 0) {
                        val = val + 65536;
                    }
                    bytes = numToByteArr(val, len);
                    break;
                case 'DWORD':
                case 'UDINT':   
                    val = checkValue(item, type[0], 0, 4294967295);
                    bytes = numToByteArr(val, len);
                    break;
                case 'DINT':                
                    val = checkValue(item, type[0], -2147483648, 2147483647);
                    if (val < 0) {
                        val = val + 4294967296;
                    }
                    bytes = numToByteArr(val, len);
                    break;
                case 'REAL':
                    val = checkValue(item, type[0]);
                    val = floatToReal(val);
                    bytes = numToByteArr(val, len);
                    break;
                case 'LREAL':
                    val = checkValue(item, type[0]);
                    val = floatToLreal(val);
                    bytes = numToByteArr(val.part2, len);
                    bytes = bytes.concat(numToByteArr(val.part1, len));
                    break;
                case 'DATE':
                    if (typeof item.val == 'object') {
                        //Delete the time portion.
                        item.val.setHours(0);
                        item.val.setMinutes(0);
                        item.val.setSeconds(0);
                        //Convert the date object in seconds since 1.1.1970 and
                        //set the time zone to UTC.
                        val = item.val.getTime() / 1000 - item.val.getTimezoneOffset() * 60;
                    } else {
                        try {
                            console.log('TAME library error: Date is not an object!)');
                            console.log(item);
                        } catch(e) {}
                    }
                    bytes = numToByteArr(val, len);
                    break;
                case 'DT':
                    if (typeof item.val == 'object') {
                        //Convert the date object in seconds since 1.1.1970 and
                        //set the time zone to UTC.
                        val = item.val.getTime() / 1000 - item.val.getTimezoneOffset() * 60;
                    } else {
                        try {
                            console.log('TAME library error: Date is not an object!)');
                            console.log(item);
                        } catch(e) {}
                    }
                    bytes = numToByteArr(val, len);
                    break;
                case 'TOD':
                    if (typeof item.val == 'object') {
                        //Delete the date portion.
                        item.val.setYear(1970);
                        item.val.setMonth(0);
                        item.val.setDate(1);
                        //Convert the date object in seconds since 1.1.1970 and
                        //set the time zone to UTC.
                        val = item.val.getTime() - item.val.getTimezoneOffset() * 60000;
                    } else {
                        try {
                            console.log('TAME library error: Date is not an object!)');
                            console.log(item);
                        } catch(e) {}
                    }
                    bytes = numToByteArr(val, len);
                    break;
                case 'STRING':
                    //If no length is given, set it to 80 characters (TwinCAT default).                 
                    strlen = (type[1] === undefined) ? plcTypeLen.STRING : parseInt(type[1],10);
    
                    if (isValidStringLen(strlen)) {
                        //If the given string length is valid and shorter then the string
                        //then use the given value to avoid an overflow, otherwise use
                        //the real string length.
                        sl = strlen < item.val.length ? strlen : item.val.length;
                        for (i = 0; i < sl; i++) {
                            bytes[i] = item.val.charCodeAt(i);
                        }
                        //Fill the string up to the given length, if necessary.
                        for (i; i < strlen; i++) {
                            bytes[i] = 0;
                        }
                        //Termination, the real string length in the PLC is
                        //the defined length + 1.
                        bytes[i] = 0;
                    }
                    break;
                case 'TIME':
                    val = item.val * 1;
                    val = toMillisec(val, type[1]);
                    if (val < 0) {
                        val = 0;
                        try {
                            console.log('TAME library warning: Lower limit for TIME variable exceeded!)');
                            console.log('value: ' + item.val + type[1]);
                            console.log(item);
                        } catch(e) {}
                    } else if (val > 4294967295) {
                        val = 4294967295;
                        try {
                            console.log('TAME library warning: Upper limit for TIME variable exceeded!)');
                            console.log('value: ' + item.val + type[1]);
                            console.log(item);
                        } catch(e) {}
                    }
                    bytes = numToByteArr(val, len);
                    break;
                case 'EndStruct':
                    //Calculate the padding bytes at the end of the structure
                    //"EndStruct" is only used with "readArrayOfStructures/writeArrayOfStructures".
                    for (i = 1; i <= item.val; i++) {
                        pData.push(0);
                    }
                    break;
                default:
                    try {
                        console.log('TAME library error: Unknown data type in write request : ' + type[0]);
                        console.log(item);
                    } catch (e) {}
                    break;
            }
            //Summarise the data.     
            pData = pData.concat(bytes);
        }

        //Convert the data to Base64.
        if (pData && pData.length > 0) {
            pData = encodeBase64(pData);
        }   

        //Generate the ADS request object and call the send function.
        adsReq = {
            method: 'Write',
            indexGroup: fields[reqDescr.fld],
            indexOffset: reqDescr.addr,
            id: reqDescr.id,
            cbRdLen: 0,
            pData: pData,
            reqDescr: reqDescr
        };
        asyncRequest(adsReq).send();  
    };

    /**
     * This is the function for creating a read request. If no value for the
     * data length ist passed, calculate the value and then call the function 
     * for sending the request.
     * 
     * @param {Object}  reqDescr    The Request Descriptor. Besides other information
     *                              this object contains the allocation of PLC and
     *                              JavaScript variables in an item list.
     */
    this.readReq = function(reqDescr) {
             
        var adsReq = {},
            itemList = reqDescr.items,
            type = [],
            listlen, mod, vlen, strlen, idx;

        //Process the request address
        processReqAddr(reqDescr);
        
        //Debug: Log the Request Descriptor to the console.
        if (reqDescr.debug) {
            try {
                console.log(reqDescr);
            } catch(e) {}
        }

        //Calculate the data length if no argument is given.
        if (typeof reqDescr.readLength != 'number') {
            
            reqDescr.readLength = 0;

            for (idx = 0, listlen = itemList.length; idx < listlen; idx++) {
                
                //Separate data type and length.
                type = itemList[idx].type.split('.');

                //Set the length of the PLC variable.
                if (type[0] == 'STRING') { 
                    if (typeof type[1] == 'string') {
                        strlen = parseInt(type[1], 10);
                    }
                    vlen = (isValidStringLen(strlen) ?  strlen : plcTypeLen[type[0]]) + 1;
                } else {
                    vlen = plcTypeLen[type[0]];
                }
                
                if (reqDescr.seq === true) {
                    //Add the length of the PLC variables if continuously addressing is used.
                    if (reqDescr.dataAlign4 === true && vlen > 1 && type[0] != 'STRING' && reqDescr.readLength > 0) {
                        mod = reqDescr.readLength % vlen;
                        if (mod > 0) {
                            reqDescr.readLength += vlen - mod;
                        }    
                    }
                    reqDescr.readLength += vlen;
                } else {
                    //Last element if single addresses are given.
                    reqDescr.readLength = vlen + itemList[idx].addr - reqDescr.addr;
                }
            }
        }
        
        //Generate the ADS request object and call the send function.
        adsReq = {
            method: 'Read',
            indexGroup: fields[reqDescr.fld],
            indexOffset: reqDescr.addr,
            cbRdLen: reqDescr.readLength,
            id: reqDescr.id,
            reqDescr: reqDescr
        };
        asyncRequest(adsReq).send();
    };

    /**
     * The shortcuts for reading and writing data.
     * 
     * @param {Object} args
     */
    this.writeBool = function(args) { createSingleDescriptor('Write', 'BOOL', args); };
    this.writeByte = function(args) { createSingleDescriptor('Write', 'BYTE', args); };
    this.writeUsint = function(args) { createSingleDescriptor('Write', 'USINT', args); };
    this.writeSint = function(args) { createSingleDescriptor('Write', 'SINT', args); };
    this.writeWord = function(args) { createSingleDescriptor('Write', 'WORD', args); };
    this.writeUint = function(args) { createSingleDescriptor('Write', 'UINT', args); };
    this.writeInt = function(args) { createSingleDescriptor('Write', 'INT', args); };
    this.writeInt1Dp = function(args) { createSingleDescriptor('Write', 'INT1DP', args); };
    this.writeDword = function(args) { createSingleDescriptor('Write', 'DWORD', args); };
    this.writeUdint = function(args) { createSingleDescriptor('Write', 'UDINT', args); };
    this.writeDint = function(args) { createSingleDescriptor('Write', 'DINT', args); };
    this.writeReal = function(args) { createSingleDescriptor('Write', 'REAL', args); };
    this.writeLreal = function(args) { createSingleDescriptor('Write', 'LREAL', args); };
    this.writeString = function(args) { createSingleDescriptor('Write', 'STRING', args); };
    this.writeTime = function(args) { createSingleDescriptor('Write', 'TIME', args); };
    this.writeTod = function(args) { createSingleDescriptor('Write', 'TOD', args); };
    this.writeDate = function(args) { createSingleDescriptor('Write', 'DATE', args); };
    this.writeDt = function(args) { createSingleDescriptor('Write', 'DT', args); };
    
    this.readBool = function(args) { createSingleDescriptor('Read', 'BOOL', args); };
    this.readByte = function(args) { createSingleDescriptor('Read', 'BYTE', args); };
    this.readUsint = function(args) { createSingleDescriptor('Read', 'USINT', args); };
    this.readSint = function(args) { createSingleDescriptor('Read', 'SINT', args); };
    this.readWord = function(args) { createSingleDescriptor('Read', 'WORD', args); };
    this.readUint = function(args) { createSingleDescriptor('Read', 'UINT', args); };
    this.readInt = function(args) { createSingleDescriptor('Read', 'INT', args); };
    this.readInt1Dp = function(args) { createSingleDescriptor('Read', 'INT1DP', args); };
    this.readDword = function(args) { createSingleDescriptor('Read', 'DWORD', args); };
    this.readUdint = function(args) { createSingleDescriptor('Read', 'UDINT', args); };
    this.readDint = function(args) { createSingleDescriptor('Read', 'DINT', args); };
    this.readReal = function(args) { createSingleDescriptor('Read', 'REAL', args); };
    this.readLreal = function(args) { createSingleDescriptor('Read', 'LREAL', args); };
    this.readString = function(args) { createSingleDescriptor('Read', 'STRING', args); };
    this.readTime = function(args) { createSingleDescriptor('Read', 'TIME', args); };
    this.readTod = function(args) { createSingleDescriptor('Read', 'TOD', args); };
    this.readDate = function(args) { createSingleDescriptor('Read', 'DATE', args); };
    this.readDt = function(args) { createSingleDescriptor('Read', 'DT', args); };
    
    this.writeStruct = function(args) { createStructDescriptor('Write', args); };
    this.readStruct = function(args) { createStructDescriptor('Read', args); };
    
    this.writeArrayOfBool = function(args) { createArrayDescriptor('Write', 'BOOL', args); };
    this.writeArrayOfByte = function(args) { createArrayDescriptor('Write', 'BYTE', args); };
    this.writeArrayOfUsint = function(args) { createArrayDescriptor('Write', 'USINT', args); };
    this.writeArrayOfSint = function(args) { createArrayDescriptor('Write', 'SINT', args); };
    this.writeArrayOfWord = function(args) { createArrayDescriptor('Write', 'WORD', args); };
    this.writeArrayOfUint = function(args) { createArrayDescriptor('Write', 'UINT', args); };
    this.writeArrayOfInt = function(args) { createArrayDescriptor('Write', 'INT', args); };
    this.writeArrayOfInt1Dp = function(args) { createArrayDescriptor('Write', 'INT1DP', args); };
    this.writeArrayOfDword = function(args) { createArrayDescriptor('Write', 'DWORD', args); };
    this.writeArrayOfUdint = function(args) { createArrayDescriptor('Write', 'UDINT', args); };
    this.writeArrayOfDint = function(args) { createArrayDescriptor('Write', 'DINT', args); };
    this.writeArrayOfReal = function(args) { createArrayDescriptor('Write', 'REAL', args); };
    this.writeArrayOfLreal = function(args) { createArrayDescriptor('Write', 'LREAL', args); };
    this.writeArrayOfString = function(args) { createArrayDescriptor('Write', 'STRING', args); };
    this.writeArrayOfTime = function(args) { createArrayDescriptor('Write', 'TIME', args); };
    this.writeArrayOfTod = function(args) { createArrayDescriptor('Write', 'TOD', args); };
    this.writeArrayOfDate = function(args) { createArrayDescriptor('Write', 'DATE', args); };
    this.writeArrayOfDt = function(args) { createArrayDescriptor('Write', 'DT', args); };
    this.writeArrayOfStruct = function(args) { createArrayDescriptor('Write', 'STRUCT', args); };

    this.readArrayOfBool = function(args) { createArrayDescriptor('Read', 'BOOL', args); };
    this.readArrayOfByte = function(args) { createArrayDescriptor('Read', 'BYTE', args); };
    this.readArrayOfUsint = function(args) { createArrayDescriptor('Read', 'USINT', args); };
    this.readArrayOfSint = function(args) { createArrayDescriptor('Read', 'SINT', args); };
    this.readArrayOfWord = function(args) { createArrayDescriptor('Read', 'WORD', args); };
    this.readArrayOfUint = function(args) { createArrayDescriptor('Read', 'UINT', args); };
    this.readArrayOfInt = function(args) { createArrayDescriptor('Read', 'INT', args); };
    this.readArrayOfInt1Dp = function(args) { createArrayDescriptor('Read', 'INT1DP', args); };
    this.readArrayOfDword = function(args) { createArrayDescriptor('Read', 'DWORD', args); };
    this.readArrayOfUdint = function(args) { createArrayDescriptor('Read', 'UDINT', args); };
    this.readArrayOfDint = function(args) { createArrayDescriptor('Read', 'DINT', args); };
    this.readArrayOfReal = function(args) { createArrayDescriptor('Read', 'REAL', args); };
    this.readArrayOfLreal = function(args) { createArrayDescriptor('Read', 'LREAL', args); };
    this.readArrayOfString = function(args) { createArrayDescriptor('Read', 'STRING', args); };
    this.readArrayOfTime = function(args) { createArrayDescriptor('Read', 'TIME', args); };
    this.readArrayOfTod = function(args) { createArrayDescriptor('Read', 'TOD', args); };
    this.readArrayOfDate = function(args) { createArrayDescriptor('Read', 'DATE', args); };
    this.readArrayOfDt = function(args) { createArrayDescriptor('Read', 'DT', args); };
    this.readArrayOfStruct = function(args) { createArrayDescriptor('Read', 'STRUCT', args); };
    
    /**
     * Process the webservice's server response.
     * 
     * @param {Object} adsReq   The object containing the arguments of the ADS request.
     */
    this.parseData = function(adsReq){
    
        var response = adsReq.xmlHttpReq.responseXML.documentElement,
            type = [],
            strAddr = 0,
            errorCode, errorText, data, d, len, plen, strlen, mod, format, idx, listlen;
        
        //Acknowledge the receive of a request with index 'id'.
        if (typeof adsReq.id == 'number') {
            currReq[adsReq.id] = 0;
        }
        
        //Look for errors in the response string.
        try {
            errorText = response.getElementsByTagName('faultstring')[0].firstChild.data;
            try {
                errorCode = response.getElementsByTagName('errorcode')[0].firstChild.data;
            } catch (e) {
                errorCode = '-';
            }
            try {
                console.log('TAME library error: Message from server:  ' + errorText + ' (' + errorCode + ')');
            } catch (e) {}
            
            return;
        } catch (e) {
            errorCode = 0;
        }
        
        //Decode data if it's a read request.
        if (adsReq.method === 'Read') {
        
            var itemList = adsReq.reqDescr.items;
            
            try {
                //Normalize data (esp. for Firefox, who splits data in 4k chunks)
                if (typeof response.normalize == 'function') {
                    response.normalize();
                }
                
                data = decodeBase64(response.getElementsByTagName('ppData')[0].firstChild.data);
                
                //Run through the elements in the item list.
                for (idx = 0, listlen = itemList.length; idx < listlen; idx++) {
                    
                    //Split data type and formatting string.
                    type.length = 1;
                    type = itemList[idx].type.split('.');
                    
                    //Join the formatting string if there were points in it.
                    if (type.length > 2) {
                        format = type.slice(1).join('.');
                    } else {
                        format = type[1];
                    }
                    
                    //Get the length of the data types.
                    len = plcTypeLen[type[0]];
                    
                    //Set the length for calculating padding bytes
                    plen = len < 4 ? len : 4;
                    
                    //Calculate the place of the element in the data string
                    if (adsReq.reqDescr.seq !== true) {
                        //If variable addresses are used.
                        strAddr = itemList[idx].addr - adsReq.reqDescr.addr;
                    } else if (adsReq.reqDescr.dataAlign4 === true && plen > 1 && type[0] != 'STRING' && strAddr > 0) {
                        //Compute the address for a 4-byte alignment in case of a structure.
                        mod = strAddr % plen;
                        if (mod > 0) {
                            strAddr += plen - mod;
                        }
                    }
                    //console.log(strAddr + '; ' + type[0]);
                    
                    switch (type[0]) {
                        case 'BOOL':
                            d = (data.charCodeAt(strAddr) != '0');
                            break;
                        case 'BYTE':
                        case 'USINT':
                            d = parsePlcUsint(data.substr(strAddr, len));
                            break;
                        case 'SINT':
                            d = parsePlcSint(data.substr(strAddr, len));
                            break;
                        case 'WORD':
                        case 'UINT':
                            d = parsePlcUint(data.substr(strAddr, len));
                            break;
                        case 'INT':
                            d = parsePlcInt(data.substr(strAddr, len));
                            break;
                        case 'INT1DP':
                            d = ((parsePlcInt(data.substr(strAddr, len))) / 10).toFixed(1);
                            break;
                        case 'DWORD':
                        case 'UDINT':
                            d = parsePlcUdint(data.substr(strAddr, len));
                            break;
                        case 'DINT':
                            d = parsePlcDint(data.substr(strAddr, len));
                            break;
                        case 'REAL':
                            d = parsePlcReal(data.substr(strAddr, len));
                            if (typeof format == 'string') {
                                d = d.toFixed(parseInt(format, 10));
                            }
                            break;
                        case 'LREAL':
                            d = parsePlcLreal(data.substr(strAddr, len));
                            if (typeof format == 'string') {
                                d = d.toFixed(parseInt(format, 10));
                            }
                            break;
                        case 'STRING':
                            if (typeof format == 'string') {
                                strlen = parseInt(format, 10);
                            }
                            len = (isValidStringLen(strlen) ? strlen : len) + 1;
                            d = parsePlcString(data.substr(strAddr, len));
                            break;
                        case 'TOD':
                            d = parsePlcTod(data.substr(strAddr, len), format);
                            break;
                        case 'TIME':
                            d = parsePlcTime(data.substr(strAddr, len), format);
                            break;
                        case 'DT':
                        case 'DATE':
                            d = parsePlcDate(data.substr(strAddr, len), format);
                            break;
                        case 'EndStruct':
                            //Set the length of the padding bytes at the end of the structure
                            //"EndStruct" is only used with "readArrayOfStructures/writeArrayOfStructures".
                            len = itemList[idx].val;
                            break;
                        default:
                            try {
                                console.log('TAME library error: Unknown data type at parsing read request: ' + itemList[idx].type);
                            } catch (e) {}
                            break;
                    }
                    //Parse the name of the variable and write the data
                    if (type[0] !== 'EndStruct') {
                        parseVarName(itemList[idx].jvar, d, adsReq.reqDescr.dataObj, itemList[idx].prefix, itemList[idx].suffix);
                    }
                    //Set the next address
                    if (adsReq.reqDescr.seq === true) {
                        strAddr += len;
                    }
                }
            } catch (e) {
                try {
                    console.log('TAME library error: Parsing Failed:' + e);
                    console.log(itemList[idx]);
                } catch (e) {}
                return;
            }
        }
        
        //Call the On-Complete-Script.
        if (typeof adsReq.reqDescr.oc == 'function') {
            if (typeof adsReq.reqDescr.ocd == 'number') {
                window.setTimeout(adsReq.reqDescr.oc, adsReq.reqDescr.ocd);
            }
            else {
                adsReq.reqDescr.oc();
            }
        }
    };
};


/**
 * Function for creating the Webservice Client.
 * 
 * @param {Object} service  Contains the paramters of the webservice.
 */
TAME.WebServiceClient.createClient = function(service) {
    return new TAME.WebServiceClient(service);
};

