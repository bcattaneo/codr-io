var oHelpers = require('./public/javascripts/helpers/helpers');

var Document = oHelpers.createClass(
{
    oData: null,       // Document data
    _aDateKeys: null,  // Keys that should be parsed as dates (recursive).
    
    __init__: function(optionalJSONorObj)
    {
        // Default values.
        this._aDateKeys = ['oDateCreated'];
        this._oData = {
            bReadOnly: false,
            aSnapshots: [],
            sParentID: '',
            sMode: '',
            sText: '',
            sTitle: 'Untitled',
            aChatHistory: [],
            bIsSnapshot: false,
            oDateCreated: new Date()
        }            
        if (optionalJSONorObj)
        {
            if (typeof(optionalJSONorObj) == 'string')
                oData = oHelpers.fromJSON(optionalJSONorObj);
            else if (typeof(optionalJSONorObj) == 'object')
                oData = optionalJSONorObj;
            else
                oHelpers.assert(false, 'Invalid document data type.');
            
            // Set values.
            for (var sKey in oData)
                this.set(sKey, oData[sKey]);
        }
    },
    
    set: function(sKey, val)
    {
        oHelpers.assert(sKey in this._oData, 'Error: Can\'t set invalid doc attr: ' + sKey);
        oHelpers.assert(typeof(val) == typeof(this._oData[sKey]) &&
                       (val instanceof Array) == (this._oData[sKey] instanceof Array),
                        'Error: Invalid document attribute type: ' + typeof(val) + ' for doc attr:  ' + sKey);
        this._oData[sKey] = val;
    },
    
    get: function(sKey)
    {
        oHelpers.assert(sKey in this._oData, 'Error: Can\'t get invalid doc attr: ' + sKey);
        return this._oData[sKey];
    },
    
    toJSON: function()
    {        
        return oHelpers.toJSON(this._oData);
    },
    
    clone: function(bIsSnapshot)
    {
        var oClone = new Document(this.toJSON());
        oClone.set('bIsSnapshot', bIsSnapshot || false);
        oClone.set('aSnapshots', []);
        oClone.set('oDateCreated', new Date());
        oClone.set('aChatHistory', []);
        return oClone;
    }
});

module.exports = Document;