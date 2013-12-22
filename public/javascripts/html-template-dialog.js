define(function(require)
{
    // Dependencies.
    var $            = require('lib/jquery'),
        oHelpers     = require('helpers/helpers-web'),
        oTemplatizer = require('helpers/templatizer');
        
    var sTemplate =
    [
        '<!DOCTYPE [! sDoctypeText !]>',
        '<html>',
        '    <head>',
        '        <title>[[sTitle]]</title>',
        '[% if sStyleLanguage != "None" %]' + 
        '        <style type="text/[[sStyleLanguage.toLowerCase()]]">',
        '            ',
        '            /* Your [[sStyleLanguage]] code here. */',
        '            ',
        '        </style>',
        '[% end %]' +
        '[% if sStyleLanguage == "LESS" %]' +
        '        <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/less.js/1.5.0/less.min.js"></script>',
        '[% end %]' +
        '[% if sScriptLanguage == "CoffeeScript" %]' +
        '        <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/coffee-script/1.6.3/coffee-script.min.js"></script>',
        '[% end %]' +
        '[% if sFrameworkUrl %]' + 
        '        <script type="text/javascript" src="[! sFrameworkUrl !]"></script>',
        '[% end %]' +
        '[% if sScriptLanguage != "None" %]' + 
        '        <script type="text/[[sScriptLanguage.toLowerCase()]]">',
        '            ',
        '            [% if sScriptLanguage == "CoffeeScript" %]#[% else %]//[% end %] Your [[sScriptLanguage]] code here.',
        '            ',
        '        </script>',
        '[% end %]' +
        '    </head>',
        '    <body>',
        '        ',
        '        <!-- Your HTML code here. --> ',
        '        ',
        '    </body>',
        '</html>'
    ].join('\n');
    
    //        <script type="text/javascript" src="http://cdnjs.cloudflare.com/ajax/libs/less.js/1.5.0/less.min.js"></script>

 
    var oPrimaryOptions = (
    {
        'doctype': 
        [
            'HTML 5',
            'HTML 4.01 Strict',
            'HTML 4.01 Transitional',
            'HTML 4.01 Frameset',
            'XHTML 1.0 Strict',
            'XHTML 1.0 Transitional',
            'XHTML 1.0 Frameset',
            'XHTML 1.1'
        ],
        
        'script-language':
        [
            'Javascript',
        //  'CoffeeScript',
            'None'
        ],
        
        'style-language':
        [
            'CSS',
            'LESS',
            'None'
        ],
        
        'script-framework':
        [
            'jQuery',
            'Mootools',
            'Prototype',
            'Dojo',
            'Ext JS',
            'None'
        ],
    });
    
    var oFrameworkVersions = (
    {
        'jQuery':
        [
            '2.0.3', '2.0.2', '2.0.1', '2.0.0', '1.10.2', '1.10.1', '1.10.0', '1.9.1', '1.9.0', '1.8.3', '1.8.2',
            '1.8.1', '1.8.0', '1.7.2', '1.7.1',  '1.7.0',  '1.6.4',  '1.6.3', '1.6.2', '1.6.1', '1.6.0', '1.5.2',
            '1.5.1', '1.5.0', '1.4.4', '1.4.3',  '1.4.2',  '1.4.1',  '1.4.0', '1.3.2', '1.3.1', '1.3.0', '1.2.6',
            '1.2.3'
        ],
        
        'Mootools':
        [
            '1.4.5', '1.4.4', '1.4.3', '1.4.2', '1.4.1', '1.4.0', '1.3.2', '1.3.1', '1.3.0', '1.2.5', '1.2.4',
            '1.2.3', '1.2.2', '1.2.1', '1.1.2', '1.1.1'
        ],
        
        'Prototype':
        [
            '1.7.1.0', '1.7.0.0', '1.6.1.0', '1.6.0.3', '1.6.0.2'
        ],
        
        'Dojo':
        [
            '1.9.2', '1.9.1', '1.9.0', '1.8.5', '1.8.4', '1.8.3', '1.8.2', '1.8.1', '1.8.0', '1.7.5', '1.7.4',
            '1.7.3', '1.7.2', '1.7.1', '1.7.0', '1.6.2', '1.6.1', '1.6.0', '1.5.3', '1.5.2', '1.5.1', '1.5.0',
            '1.4.5', '1.4.4', '1.4.3', '1.4.1', '1.4.0', '1.3.2', '1.3.1', '1.3.0', '1.2.3', '1.2.0', '1.1.1'
        ],
        
        'Ext JS':
        [
            '3.1.0', '3.0.0'
        ]
    });
    
    var oDoctypes =
    {
        'HTML 5':                 'html',
        'HTML 4.01 Strict':       'HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd"',
        'HTML 4.01 Transitional': 'HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd"',
        'HTML 4.01 Frameset':     'HTML PUBLIC "-//W3C//DTD HTML 4.01 Frameset//EN" "http://www.w3.org/TR/html4/frameset.dtd"',
        'XHTML 1.0 Strict':       'html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"',
        'XHTML 1.0 Transitional': 'html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"',
        'XHTML 1.0 Frameset':     'html PUBLIC "-//W3C//DTD XHTML 1.0 Frameset//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd"',
        'XHTML 1.1':              'html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"'
    };
    
    var oFrameworkUrls =
    {
        'jQuery':           '//ajax.googleapis.com/ajax/libs/jquery/__version__/jquery.min.js',
        'Mootools':         '//ajax.googleapis.com/ajax/libs/mootools/__version__/mootools-yui-compressed.js',
        'Prototype':        '//ajax.googleapis.com/ajax/libs/prototype/__version__/prototype.js',
        'Dojo':             '//ajax.googleapis.com/ajax/libs/dojo/__version__/dojo/dojo.js"',
        'Ext JS':           '//ajax.googleapis.com/ajax/libs/ext-core/__version__/ext-core.js',
        'None':             ''
    };
    
    return oHelpers.createClass(
    {
        _oWorkspace: null,
        _oToolbar: null,
        
        __init__: function(oWorkspace, oToolbar)
        {
            // Save State.
            this._oWorkspace = oWorkspace;
            this._oToolbar = oToolbar;
            
            // Populate Dropdowns.
            for (sID in oPrimaryOptions)
                this._addOptions($('select#' + sID), oPrimaryOptions[sID]);
            this._updateMenuItems();
            
            // Prep Templatizer.
            oTemplatizer.compileTemplate('html-insert', sTemplate);
        },
        
        onEvent: function(oEvent)
        {
            var sEventType = oEvent.type;
            var jTarget = $(oEvent.target);
            
            // Update Framework Versions.
            if (sEventType == 'change')
            {
                this._updateMenuItems();
                return;
            }
            
            // Insert template.
            if (sEventType == 'click' && jTarget.is('button#insert-template'))
            {
                this._insertTemplate();
                return;
            }
        },
        
        _updateMenuItems: function()
        {
            // Enable/Disable framework options.
            if ($('select#script-language').val() == 'None')
                $('select#script-framework').val('None').prop('disabled', true);
            
            // Update framework versions dropdown.
            var sSelectedFramework = $('select#script-framework').val();
            var jVersions = $('#framework-version');
            if (jVersions.data('sFrameworkName') != sSelectedFramework)
            {
                jVersions.data('sFrameworkName', sSelectedFramework);
                jVersions.empty();
                if (sSelectedFramework in oFrameworkVersions)
                {
                    this._addOptions(jVersions, oFrameworkVersions[sSelectedFramework], 'Version ');
                    jVersions.prop('disabled', false);
                }
                else
                    jVersions.prop('disabled', true);
            }
        },
        
        _addOptions: function(jSelect, aOptions, sOptionalsPrefix)
        {
            var sPrefix = sOptionalsPrefix || '';
            for (var i in aOptions)
                $('<option></option>').text(sPrefix + aOptions[i]).appendTo(jSelect);
        },
        
        _insertTemplate: function()
        {
            var oData = this._serializeOptions();
            oData.sTitle = 'TODO: Get title!';
            var sText = oTemplatizer.render('html-insert', oData);
            this._oWorkspace.insertLines(sText.split('\n'));
            this._oWorkspace.blurFocusedObject(this._oToolbar);
        },
        
        _serializeOptions: function()
        {
            var sFrameworkVersion = ($('#framework-version').val() + '').replace('Version ', '');
            return(
            {
                sDoctypeName:      $('#doctype').val(),
                sDoctypeText:      oDoctypes[$('#doctype').val()],
                sScriptLanguage:   $('#script-language').val(),
                sStyleLanguage:    $('#style-language').val(),
                sScriptFramework:  $('#script-framework').val(),
                sFrameworkVersion: sFrameworkVersion,
                sFrameworkUrl:     oFrameworkUrls[$('#script-framework').val()].replace('__version__', sFrameworkVersion),
                bAutoInsert:       $('#auto-insert').val() == 'Yes'
            });
        },
        
        _loadSerializedOptions: function(oOptions)
        {
            $('#doctype').val(           oOptions.sDoctype                    );
            $('#script-language').val(   oOptions.sScriptLanguage             );
            $('#style-languages').val(   oOptions.sStyleLanguage              );
            $('#script-framework').val(  oOptions.sScriptFramework || 'None'  );
            $('#framework-version').val( oOptions.sFrameworkVersion           );
            $('#auto-insert').val(      (oOptions.bAutoInsert ? 'Yes' : 'No') );
        },
    });
});