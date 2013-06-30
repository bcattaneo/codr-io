
// Include Libraries.
var oOS = require('os');
var oPath = require('path');
var oExpress         = require('express');
var oWS             = require('ws');
var oHTTP           = require('http');
var oLessMiddleware = require('less-middleware');
var oHelpers        = require('./helpers');
var oAceDocument    = require('./aceDocument').Document;
var oDatabase       = require('./database');

// Error handling.
// TODO: This is a horrible hack.
process.on('uncaughtException', function (err)
{
    console.error(err); // Keep node from exiting.
});

// Create express app.
var oApp = oExpress();
oApp.configure(function()
{
    oApp.set('port', process.env.PORT || 8080);
    var oTempDir = oPath.join(oOS.tmpDir(), 'codr\\static');
    oApp.use(oLessMiddleware(
    {
        src: __dirname + '/public',
        dest: oTempDir
    }));
    
    oApp.use(oExpress.static(oPath.join(__dirname, 'public')));
    oApp.use(oExpress.static(oTempDir));

    /* Save static index.html */
    oApp.get('^/$',               function(req, res) { res.sendfile('public/index.html'); });
    oApp.get('/[a-z0-9]+/?$',     function(req, res) { res.sendfile('public/index.html'); });
    
    /* Preview files as HTML. */
    /* Download file */
    oApp.get('/:DocumentID([a-z0-9]+)/:Action(preview|download)/?$', function(req, res)
    {
        var sDocumentID = req.params['DocumentID'];
        
        // Set response headers for HTML preview or file download.
        if (req.params['Action'] == 'download')
        {
            res.set('Content-Type', 'text/plain');
            res.set('Content-Disposition', 'attachment; filename="' + sDocumentID + '"');
        }
        else if (req.params['Action'] == 'preview')
        {
            res.set('Content-Type', 'text/html');
        }

        // Send document text.
        var oDocument = null;
        if (sDocumentID in g_oWorkspaces)
        {
            oDocument = g_oWorkspaces[sDocumentID].getDocument();
            res.send(oDocument.get('sText'));
        }
        else
        {
            oDatabase.getDocument(sDocumentID, this, function(sDocumentJSON)
            {
                oDocument = new Document(sDocumentJSON);
                res.send(oDocument.get('sText'));
            });
        }
    });
});

// Instantiate server.
var oServer = oHTTP.createServer(oApp);
oServer.listen(oApp.get('port'), function()
{
    console.log("Express server listening on port " + oApp.get('port'));
});

// Instantiate websocket listener.
var oWsServer = new oWS.Server({server: oServer});
oWsServer.on('connection', function(oSocket)
{
    new Client(oSocket);
});

var g_oWorkspaces = {}; // DocumentID to Workspace instance.

var Client = oHelpers.createClass(
{
    _oSocket: null,
    _oWorkspace: null,
    _bCreatedDocument: false,
    _aPreInitActionQueue: null,
    _bInitialized: false,
    _bClosed: false,
    _sUsername: '',
    
    __init__: function(oSocket)
    {
        this._aPreInitActionQueue = [];
        this._oSocket = oSocket;
        oSocket.on('message', oHelpers.createCallback(this, this._onClientAction));
        oSocket.on('close', oHelpers.createCallback(this, function()
        {
            if (this._oWorkspace)
                this._oWorkspace.removeClient(this);
            else
                this._bClosed = true;
        }));
    },
    
    setUsername: function(sUsername)
    {
        this._sUsername = sUsername;
    },

    getUsername: function()
    {
        oHelpers.assert(this._sUsername, 'The username is not yet initialized.')
        return this._sUsername;
    },
    
    clientCreatedDocument: function()
    {
        return this._bCreatedDocument;
    },
    
    onDocumentLoad: function()
    {    
        // Send queued actions.
        this._bInitialized = true;
        while (this._aPreInitActionQueue.length)
        {
            this._onClientAction(this._aPreInitActionQueue.pop());
        }
    },
    
    sendAction: function(param1, param2) /* either sendAction(sType, oData) or sendAction(oAction)*/
    {
        if (typeof(param1) == 'string')
        {
            this._oSocket.send(JSON.stringify(
            {
                sType: param1,
                oData: param2
            }));     
        }
        else
        {
            oHelpers.assert(typeof(param1) == 'object', 'Invalid parameter type');
            this._oSocket.send(JSON.stringify(param1));
        }
    },

    _onClientAction: function(sJSONAction)
    {
        var oAction = JSON.parse(sJSONAction);
        switch(oAction.sType)
        {
            case 'createDocument':
                this._bCreatedDocument = true;
                oDatabase.createDocument(JSON.stringify(oAction.oData), this, function(sDocumentID)
                {
                    this._addToWorkspace(sDocumentID);
                });
                break;
            
            case 'openDocument':
                this._addToWorkspace(oAction.oData.sDocumentID);
                break;
            
            default:
                if (this._bInitialized )
                    this._oWorkspace.onClientAction(this, oAction);
                else
                    this._aPreInitActionQueue.push(sJSONAction);
        }
    },
    
    _addToWorkspace: function(sDocumentID)
    {
        // Validate.
        oHelpers.assert(!this._oWorkspace, 'Client already connected.');
        if (this._bClosed)
            return;
                
        // Get or add workspace.
        if (sDocumentID in g_oWorkspaces)
        {
            this._oWorkspace = g_oWorkspaces[sDocumentID];
            this._oWorkspace.addClient(this);
        }
        else
        {
            // TODO (AldenD 06-29-2013): On document creation we could tell the workspace
            // not to go to the database and directly give it the mode.
            this._oWorkspace = new Workspace(sDocumentID, this);
        }
    }
});

var Workspace = oHelpers.createClass(
{
    // Data
    _oAceDocument: null,
    _oDocument: null,
    _sDocumentID: '',

    // Loading state
    _bDocumentLoaded: false,
    
    // Audo save
    _iAutoSaveTimeoutID: null,
    _iAutoSaveTimeoutLength: 30, /* auto save every 30 seconds */
    
    // Editing
    _aClients: null,
    _oRequestEditingInfo: null,
    _oCurrentEditingClient: null,
    _oLastSelAction: null,

    // PeoplePane
    _aChatHistory: null,
    _iGeneratedClientNames: 0,
    _aCurrentlyTyping: null,
    
    __init__: function(sDocumentID, oClient)
    {
        g_oWorkspaces[sDocumentID] = this;
        this._sDocumentID = sDocumentID;
        this._aClients = [];
        this._aChatHistory = [];
        this._aCurrentlyTyping = [];
        
        // Add the intial client.
        this.addClient(oClient);
        
        // Open document.
        oDatabase.getDocument(sDocumentID, this, function(sDocumentJSON)
        {
            // Save pointer to document.
            this._oDocument = new Document(sDocumentJSON);
            this._oAceDocument = new oAceDocument(this._oDocument.get('sText'));
            this._oAceDocument.setNewLineMode('windows'); // TODO (Will 6/29/2013) test in other environments
            this._bDocumentLoaded = true;
            
            // Fire client "load" callbacks.
            for (var i in this._aClients)
            {
                this._setClientInitialValue(this._aClients[i]);
                this._aClients[i].onDocumentLoad();
            }
        });
    },

    addClient: function(oClient)
    {
        // Assign the client a username.
        oClient.setUsername(this._generateNewClientName());
        
        // Add the client.
        this._aClients.push(oClient);
        if (this._bDocumentLoaded)
        {
            this._setClientInitialValue(oClient);
            oClient.onDocumentLoad();
        }
        
        // Automatically start editing if you're the only client.
        if (this._aClients.length == 1)
        {
            this._oCurrentEditingClient = oClient;
        }
        
        // Propagate to the other clients.
        if (this._bDocumentLoaded)
        {
            this._broadcastAction(oClient, {
                'sType': 'addUser',
                'oData': {
                    'sUsername': oClient.getUsername()
                }
            });            
        }
    },
    
    removeClient: function(oClient)
    {
        // Remove editing rights.
        if (oClient == this._oCurrentEditingClient)
        {
            this._removeSelection();
            this._oCurrentEditingClient = null;
            this._oLastSelAction = null;
        }

        // Remove the client.
        var iIndex = this._aClients.indexOf(oClient);
        this._aClients.splice(iIndex, 1);
                
        // Close the document (if no editors left).
        if (this._aClients.length === 0)
        {
            this._save(oHelpers.createCallback(this, function()
            {
                if (this._aClients.length === 0)
                    delete g_oWorkspaces[this._sDocumentID];
            }));
        }
        
        // Update other clients (if document loaded).
        else if (this._bDocumentLoaded)
        {
            if (this._aCurrentlyTyping.indexOf(oClient) >= 0)
            {
                this._broadcastAction(oClient,
                {
                    'sType': 'endTyping',
                    'oData': {'sUsername': oClient.getUsername()}
                });
                this._aCurrentlyTyping.splice(this._aCurrentlyTyping.indexOf(oClient), 1);
            }
    
            this._broadcastAction(oClient,
            {
                'sType': 'removeUser',
                'oData': {'sUsername': oClient.getUsername()}
            });            
        }
    },

    _setClientInitialValue: function(oClient)
    {
        this._assertDocumentLoaded();

        // Send username.
        oClient.sendAction('connect',
        {
            'sUsername': oClient.getUsername()
        });
        
        // Send documentID on document creation.
        if (oClient.clientCreatedDocument())
        {
            oClient.sendAction('setDocumentID',
            {
                sDocumentID: this._sDocumentID
            });
        }
        
        // Otherwise, Send current document state.
        else
        {
            // Set editor text.
            oClient.sendAction('setDocumentData',
            {
                sText: this._oAceDocument.getValue()
            });
            
            // Grant edit perms.
            if (this._oCurrentEditingClient == oClient)
            {
                oClient.sendAction('editRightsGranted');
            }
    
            // Set selection.
            if (this._oLastSelAction)
            {
                oClient.sendAction(this._oLastSelAction);
            }
    
            // Set mode (language.)
            oClient.sendAction('setMode',
            {
                sMode: this._oDocument.get('sMode')
            });
    
            // Set title.
            oClient.sendAction('setDocumentTitle', 
            {
                sTitle: this._oDocument.get('sTitle')
            });
            
            // Set currently viewing.
            for (var iClientIndex in this._aClients)
            {
                var oOtherClient = this._aClients[iClientIndex];
                if (oOtherClient != oClient)
                {
                    oClient.sendAction('addUser',
                    {
                        'sUsername': oOtherClient.getUsername()
                    });
                }
            }
            
            // Set currently typing users.
            for (var i = 0; i < this._aCurrentlyTyping.length; i++)
            {
                oClient.sendAction('startTyping',
                {
                    'sUsername': this._aCurrentlyTyping[i].getUsername()
                });
            }
            
            // Set chat history.
            for (var i = 0; i < this._aChatHistory.length; i++)
            {
                oClient.sendAction('newChatMessage',
                {
                    'sUsername': this._aChatHistory[i].sUsername,
                    'sMessage':  this._aChatHistory[i].sMessage
                });
            }            
        }
    },
    
    getDocument: function()
    {
        this._assertDocumentLoaded();
        this._updateDocumentText();
        return this._oDocument;
    },
  
    onClientAction: function(oClient, oAction)
    {
        this._assertDocumentLoaded();
        switch(oAction.sType)
        {
            case 'requestEditRights':
                if (this._oCurrentEditingClient)
                {
                    this._oCurrentEditingClient.sendAction('removeEditRights');
                    this._oRequestEditingInfo = {oClient: oClient, oSelection: oAction.oData};
                }
                else
                {
                    this._grantEditRights(oClient, oAction.oData);
                }
                break;
        
            case 'releaseEditRights':
                if (this._oRequestEditingInfo)
                {
                    this._grantEditRights( this._oRequestEditingInfo.oClient,
                                           this._oRequestEditingInfo.oSelection);
                    this._oRequestEditingInfo = null;
                }
                else
                {
                    this._removeSelection();
                    this._oCurrentEditingClient = null;
                }
                break;
            
            case 'setMode':
                this._broadcastAction(oClient, oAction);
                this._oDocument.set('sMode', oAction.oData.sMode);
                break;
                
            case 'setSelection':
                this._broadcastAction(oClient, oAction);
                this._oLastSelAction = oAction;
                break;
            
            case 'setDocumentTitle':
                this._broadcastAction(oClient, oAction);
                this._oDocument.set('sTitle', oAction.oData.sTitle);
                break;
            
            case 'aceDelta':
                this._broadcastAction(oClient, oAction);
                this._oAceDocument.applyDeltas([oAction.oData]);
                this._setAutoSaveTimeout();
                break;

            // People Pane
            case 'newChatMessage':
                var oNewAction = {
                    'sType': 'newChatMessage',
                    'oData': {
                        'sUsername': oClient.getUsername(),
                        'sMessage': oAction.oData.sMessage
                    }
                };
                this._broadcastAction(oClient, oNewAction);
                this._aChatHistory.push(oNewAction.oData);
                break;

            case 'startTyping':
                this._aCurrentlyTyping.push(oClient);
                this._broadcastAction(oClient,
                {
                    'sType': 'startTyping',
                    'oData': {'sUsername': oClient.getUsername()}
                });
                break;

            case 'endTyping':
                this._aCurrentlyTyping.splice(this._aCurrentlyTyping.indexOf(oClient), 1);
                this._broadcastAction(oClient,
                {
                    'sType': 'endTyping',
                    'oData': {'sUsername': oClient.getUsername()}
                });
                break;
            default:
                oHelpers.assert(false, 'Unrecognized event type: "' + oAction.sType + '"');
        }
    },

    _generateNewClientName: function()
    {
        this._iGeneratedClientNames++;
        return 'User ' + this._iGeneratedClientNames;
    },

    _broadcastAction: function(oSendingClient, oAction)
    {
        // Send actions to all other clients.
        this._assertDocumentLoaded();
        for (var i = 0; i < this._aClients.length; i++)
        {
            var oClient = this._aClients[i];
            if(oClient != oSendingClient)
                oClient.sendAction(oAction)
        }
    },
    
    _grantEditRights: function(oClient, oSelection)
    {
        oClient.sendAction('editRightsGranted');
        this._oCurrentEditingClient = oClient;
        this._broadcastAction(oClient,
        {
            sType: 'setSelection',
            oData: oSelection
        });
    },
    
    _removeSelection: function()
    {
        oHelpers.assert(this._oCurrentEditingClient, 'You can\'t remove a selection if there\'s no editing client.')
        this._broadcastAction(this._oCurrentEditingClient,
        {
            sType: 'removeSelection',
            oData: null
        });
    },

    _save: function()
    {
        this._assertDocumentLoaded();
        this._updateDocumentText();
        this._clearAutoSaveTimeout();
        oDatabase.saveDocument(this._sDocumentID, this._oDocument.toJSON(), this, function(sError)
        {
            // Handle save errors.
        });
    },
    
    _setAutoSaveTimeout: function()
    {
        if (this._iAutoSaveTimeout === null)
        {
            var fnSave = oHelpers.createCallback(this, this._save);
            this._iAutoSaveTimeoutID = setTimeout(fnSave, this._iAutoSaveTimeoutLength);
        }        
    },
    
    _clearAutoSaveTimeout: function()
    {
        clearTimeout(this._iAutoSaveTimeoutID);
        this._iAutoSaveTimeoutID = null;        
    },
    
    _updateDocumentText: function()
    {
        this._oDocument.set('sText', this._oAceDocument.getValue());
    },
    
    _assertDocumentLoaded: function()
    {
        oHelpers.assert(this._bDocumentLoaded, 'Document not yet initialized.');
    }
});


var Document = oHelpers.createClass(
{
    _bReadOnly:     false,
    _aChildrenIDs:  null,
    _sParentID:     '',
    _sMode:         '',
    _sText:         '',
    _sTitle:        'Untitled',

    __init__: function(sJSON)
    {
        var oData = JSON.parse(sJSON);
        for (sKey in oData)
            this.set(sKey, oData[sKey]);
    },
    
    set: function(sKey, oValue)
    {
        var sProp = '_' + sKey;
        oHelpers.assert (sProp in this, 'Invalid key: ' + sKey);
        oHelpers.assert (typeof(oValue) == typeof(this[sProp]), 'Invalid type "' + typeof(oValue) + '" for key "' + sKey + '"');
        this[sProp] = oValue;
    },
    
    get: function(sKey)
    {
        var sProp = '_' + sKey;
        oHelpers.assert (sProp in this, 'Invalid key: ' + sKey);
        return JSON.parse(JSON.stringify(this[sProp])); // Deep clone.
    },

    toJSON: function()
    {
        var oData = {};
        for (sProp in this)
        {
            if (sProp.charAt(0) == '_' && typeof(this[sProp]) != 'function')
                oData[sProp.substr(1)] = this[sProp];
        }
        return JSON.stringify(oData);
    }
});
