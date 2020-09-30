// 1. Script Begins
({
    //*************************************************************************
    // 2. Information
    //*************************************************************************
    Info:
    {   Title:"Telegram Bot v1.0.12",
        Author:"Joan A. Llarch - Barcelona - October 2020",
        Version:"1.0.12",
        Description:"Telegram Bot App" ,
        Setup:
        {   botToken:
            {   Widget:"LineEdit",
                MaxLength: 100,
                Width: 420,
                Name:"Bot Token",
            },	
            pin_number:	 
            {   Widget:"LineEdit",
                MaxLength: 6,
                Width: 60,
                Name:"Login Pin",
            },	                  
        },  
        Commands: 
        {   get_me: 
            {   Name: "Send Get Me",
                GroupCmdOrder: "3",
            },
            send_text_message: 
            {   Name: "Send Text Message",
                GroupCmdOrder: "1",
                Params: {
                    chat_id: {
                        Name: "Chat Id or @Channel Name",
                        Type: "String",
                        MaxLength: 64,         
                    },
                    parse_mode: {
                        Name: "Text Format",
                        Type: "Enum",
                        Items: [ "None", "MarkdownV2", "HTML" ],          
                    },
                    text: {
                        Name: "Text",
                        Type: "String",
                        MaxLength: 4096,        
                    },
                    disable_notification:{
                        Name: "Silent Notification",
                        Type: "Enum",
                        Items: [ "No Silent", "Silent" ],          
                    },
                },
            },
            send_document: 
            {   Name: "Send String as a File",
                GroupCmdOrder: "2",
                Params: {
                    chat_id: {
                        Name: "Chat Id or @Channel Name",
                        Type: "String",
                        MaxLength: 64,         
                    },
                    filename: {
                        Name: "File Name",
                        Type: "String",   
                        MaxLength: 64,    
                    },
                    text: {
                        Name: "File String",
                        Type: "String",       
                    },
                },
            },

        },    
    },
    //*************************************************************************
    //  3. Setup Variables
    //*************************************************************************
    Setup:
    {   botToken: "",
        pin_number: "",
    },
    //*************************************************************************
    //  4. Device Variables
    //*************************************************************************
    Device: 
    {   // status
        lastStatusCode: "",
        lastError:"",
        // raw strings received
        lastUpdateRecv: "",
        lastGetMeRecv: "",
        lastSentRecv: "",
        lastDocRecv: "",
        lastCallbackRecv: "",
        lastEditMesTextRecv: "",
        // last message received
        messageRcv: "",
        // from the last message received
        messageText: "",
        messageUserId: "",
        messageUserName: "",
        // oks
        messageUpdateOk: "",
        messageGetMeOk: "",
        messageSentOk: "",
        messageDocOk: "",
        messageCallOk: "",
        messageEditOk: "",
        // all received messages list
        recvMessgList: "",
        // in the Device object for easy debuging
        asnwersOffset: 0,
        counterLoop: 0,
        loginMessage_id: 0,
        pin_string: "",
        usersLog: "",
        userLogJson: "",
    },
    //*************************************************************************
    //  4. Local Script Variables
    //*************************************************************************
    // "constants"
    itemsEncoding: false,                               // false => encoding by manager
    telegramUrl: "https://api.telegram.org/bot",
    endpointGetUpdates: "/getUpdates",
    endpointSendMessage: "/sendMessage",
    endpointGetMe: "/getMe",
    endpointAnsCallbackQuery: "/answerCallbackQuery",
    endpointeditMessageText: "/editMessageText",
    endpointSendDocument: "/sendDocument",
    errorNoJson: "Invalid json format",
    boundary: "c7cbfdd911b4e720f1dd8f479c50bc7f",       // for example...
    medialonDevice: "Manager",                          // or change to "Showmaster"
    medialonVars: [ "ConnectedPanels", "ConnectedWebpanelsIP","CPUUsage","CurrentDate",
    "CurrentDay","CurrentProjectFile","CurrentProjectTitle","CurrentStatus",
    "CurrentTime","HostIPAddresses","Hostname","MemoryUsage"],
    limitMessg: 5,
    answerTimeOutSeconds: 20,                           // get_update timeout
    // global variables
    answerTimeOutFlag: 0,
    timeoutId: 0,
    longPoll: 0,                    
    recvMessgArray: [],
    len_pin: 0,
    messageLogin: "",      
    secondsCounter: 0,
    usersLog: [],
    //*************************************************************************
    //  5. Script Public Functions
    //*************************************************************************
    //  SEND TEXT MESSAGE
    send_text_message: function( chat_id, parse_mode, text, disable_notification ){
        this._clear_device_variables();
        //
        var url = this.telegramUrl + this.Setup.botToken + this.endpointSendMessage;
        var requestHeaders = this._build_header ( "json", this.HttpClientSendMessage );
        // data
        var items = "";
        var data = {};
        data.chat_id = chat_id;
        data.text = text;
        if ( parse_mode == '1'  )
            data.parse_mode = "MarkdownV2";
        else if ( parse_mode == '2')
        {   data.parse_mode = "HTML";
        }
        data.disable_notification = false;
        if ( disable_notification == '1'  )
            data.disable_notification = true;
        // make a post
        var data_json = JSON.stringify( data );
        this.HttpClientSendMessage.post(url, requestHeaders, data_json, items, this.itemsEncoding);
    },
    //*************************************************************************
    //  SEND DOCUMENT - text/plain
    send_document: function( chat_id, filename, text ){
        this._clear_device_variables();
        this._send_document( chat_id, filename, text );
    },
    //*************************************************************************
    //  SEND GET ME
    get_me: function(){
        this._clear_device_variables();
        //
        var url = this.telegramUrl + this.Setup.botToken + this.endpointGetMe;
        var requestHeaders = this._build_header ( "json", this.HttpClientGetMe );
        // data
        var items = "";
        var data_json = "";
        // make a post
        this.HttpClientGetMe.post(url, requestHeaders, data_json, items, this.itemsEncoding);
    },
    //*************************************************************************
    //  5b. Script Private Functions - MAIN FUNCTIONS
    //*************************************************************************
    // START
    _first_task: function(){
        // in miliseconds 
        QMedialon.SetInterval(this._loop_for_ever, 1000 );
    },
    //*************************************************************************
    //  LOOP FOR EVER - every 500ms
    _loop_for_ever: function(){
        if ( this.answerTimeOutFlag == 0 )
        {   // set flag timeout
            this.answerTimeOutFlag = 1;
            this.Device.counterLoop = 0;
            this._get_updates();
        }
        else
            this.Device.counterLoop++;
        // timeout users login
        this.secondsCounter++;;
        if ( this.secondsCounter % 5 == 0 )  
            // check users timeout every 5 seconds
            this._user_log_out();
    },
    //*************************************************************************
    //  GET UPDATES
    _get_updates: function(){
        this.Device.messageUpdateOk = "";
        var url = this.telegramUrl + this.Setup.botToken + this.endpointGetUpdates;
        var requestHeaders = this._build_header ( "json", this.HttpClientGetUpdates );
        // data
        var items = "";
        var data = {};
        data.offset = this.Device.asnwersOffset;
        data.limit = this.limitMessg;
        data.timeout = this.longPoll;
        var data_json = JSON.stringify( data );
        // make a post
        this.HttpClientGetUpdates.post(url, requestHeaders, data_json, items, this.itemsEncoding);
        // launch task timeout
        this.timeoutId = QMedialon.SetTimeout(this._get_updates_timeout, this.answerTimeOutSeconds * 1000 );
    },
    //  TIMEOUT
    _get_updates_timeout: function () {
        this.answerTimeOutFlag = 0;
    },
    //*************************************************************************
    _send_document: function( chat_id, filename, text ){
        this.Device.messageDocOk = "";
        // data
        var items = "";
        var data_start_1 = "--" + this.boundary + '\r\ncontent-disposition: form-data; name="chat_id"\r\n\r\n' + chat_id + '\r\n';
        var data_start_2 = "--" + this.boundary + '\r\ncontent-disposition: form-data; name="document"; filename="' +   filename + '";\r\nContent-Type: text/plain\r\n\r\n';
        var data_end = "\r\n--" + this.boundary + "--\r\n";
        var data_post = data_start_1 + data_start_2 + text + data_end;
        var len = data_post.length;
        //
        var url = this.telegramUrl + this.Setup.botToken + this.endpointSendDocument;
        var requestHeaders = this._build_header ( "form-data", this.HttpClientSendDocument, len );
        // make a post
        this.HttpClientSendDocument.post(url, requestHeaders, data_post, items, this.itemsEncoding);
    },
    //************************************************************************
    //  5b. Script Private Functions - RESPONSES
    //************************************************************************
    //  CALLBACK GET UPDATES
    _response_get_updates: function ( response, error ) {
        if ( error.errorCode == 0 )
        {   this.Device.lastStatusCode = response.statusCode;
            // show all json string
            this.Device.lastUpdateRecv = response.data.toString();
            if ( response.data != "" )
            {   try {
                    // to object
                    var answer = JSON.parse(this.Device.lastUpdateRecv);
                }
                catch(e) {
                    this.Device.lastError = this.errorNoJson;
                    return;
                }
                this.Device.messageUpdateOk = answer.ok;
                var len = answer.result.length;
                if ( answer.ok == true && len > 0  )
                {   // get all messages ( limitMessg was the number asked )
                    for ( var i=0; i< len; i++)
                    {   var updateId = parseInt(answer.result[i].update_id, 10);
                        if ( updateId > 0 )
                        {   this.Device.asnwersOffset = updateId + 1;
                            this._parse_messages_recv( answer.result[i] );
                        }
                    }
                }
            }
            QMedialon.ClearInterval( this.timeoutId );
            this.timeoutId = 0;
            this.answerTimeOutFlag = 0;
        }
        else
        {   this.Device.lastError = error.errorText;
        }
    },
    //************************************************************************
    // RESPONSE TO SENT MESSAGES
    _response_send_message: function ( response, error ) {
        if ( error.errorCode == 0 )
        {   this.Device.lastStatusCode = response.statusCode;
            // show all json string
            this.Device.lastSentRecv = response.data.toString();
            if ( response.data != "" )
            {   try {
                    // to object
                    var answer = JSON.parse(this.Device.lastSentRecv);
                }
                catch(e) {
                    this.Device.lastError = this.errorNoJson;
                    return;
                }
                this.Device.messageSentOk = answer.ok;
                // is a keyboard login answer? 
                var r = this.messageLogin.localeCompare(answer.result.text);
                if ( r == 0)
                    // save id of the message to be able to edit it
                    this.Device.loginMessage_id = answer.result.message_id;
            }
        }
    },
    //************************************************************************
    // RESPONSE TO SENT DOCUMENT
    _response_send_document: function ( response, error ) {
        if ( error.errorCode == 0 )
        {   this.Device.lastStatusCode = response.statusCode;
            // show all json string
            this.Device.lastDocRecv = response.data.toString();
            if ( response.data != "" )
            {   try {
                    // to object
                    var answer = JSON.parse(this.Device.lastDocRecv);
                }
                catch(e) {
                    this.Device.lastError = this.errorNoJson;
                    return;
                }
                this.Device.messageDocOk = answer.ok;
            }
        }
    },
    //************************************************************************
    // RESPONSE TO GET ME
    _response_get_me: function ( response, error ) {
        if ( error.errorCode == 0 )
        {   this.lastStatusCode = response.statusCode;
            // show all json string
            this.Device.lastGetMeRecv = response.data.toString();
            if ( response.data != "" )
            {   try {
                    // to object
                    var answer = JSON.parse(this.Device.lastGetMeRecv);
                }
                catch(e) {
                    this.Device.lastError = this.errorNoJson;
                    return;
                }
                this.Device.messageGetMeOk = answer.ok;
            }
        }
    },
    //************************************************************************
    // RESPONSE TO SENT CALLBACK
    _response_send_callback: function ( response, error ) {
        if ( error.errorCode == 0 )
        {   this.Device.lastStatusCode = response.statusCode;
            // show all json string
            this.Device.lastCallbackRecv = response.data.toString();
            if ( response.data != "" )
            {   try {
                    // to object
                    var answer = JSON.parse(this.Device.lastCallbackRecv);
                }
                catch(e) {
                    this.Device.lastError = this.errorNoJson;
                    return;
                }
                this.Device.messageCallOk = answer.ok;
            }
        }
    },
    //************************************************************************
    // RESPONSE TO EDIT MESSAGE TEXT
    _response_edit_message_text: function ( response, error ) {
        if ( error.errorCode == 0 )
        {   this.Device.lastStatusCode = response.statusCode;
            // show all json string
            this.Device.lastEditMesTextRecv = response.data.toString();
            if ( response.data != "" )
            {   try {
                    // to object
                    var answer = JSON.parse(this.Device.lastEditMesTextRecv);
                }
                catch(e) {
                    this.Device.lastError = this.errorNoJson;
                    return;
                }
                this.Device.messageEditOk = answer.ok;
            }
        }
    },
    //************************************************************************
    //  5b. Script Private Functions - PARSE RECEIVED
    //************************************************************************
    _parse_messages_recv: function ( result ) {
        var items = "";
        var data = {};
        var url, data_json, r, requestHeaders, text;
        //--------------------------------------------------------------------
        // is a message?
        if ( typeof result.message != 'undefined')
        {   this._build_device_variables( result );
            text = result.message.text;
            data.from_first_name = result.message.from.first_name;
            data.chat_id = result.message.from.id;
            // parse text
            if ( text == "/start" || text == "/help" )
            {   this._start ( items, data );
            }
            else if ( text == "/login")
            {   this.Device.loginMessage_id = 0;
                this.Device.pin_string = "";
                this._login ( items, data );
            }
            else if ( text == "/main_menu")
            {   this._main_menu ( items, data );
            }
            else if ( text == "/test")
            {   // debug one way, do nothing
            }
            else
            {   this._unknown ( items, data, text );
            }
        }
        //---------------------------------------------------------------------
        // is a callback_query?
        else if ( typeof result.callback_query != 'undefined')
        {   data.chat_id = result.callback_query.from.id;
            data.from_first_name = result.callback_query.from.first_name;
            var q_data = result.callback_query.data; 
            var number = 999;
            if ( q_data.charAt(0) == '#' )
            {   number = parseInt(q_data.slice(1), 10 );
            }
            data.callback_query_id = result.callback_query.id;
            // loging keyboard?
            if ( number < 20)
            {   if ( number == 10)
                    data.text = "Clear";
                else if ( number == 11)
                    data.text = "Ok";
                else
                    data.text = number;
                data.callback_query_id = result.callback_query.id;
                data_json = JSON.stringify( data );
                // post user feedback
                url = this.telegramUrl + this.Setup.botToken + this.endpointAnsCallbackQuery;
                requestHeaders = this._build_header ( "json", this.HttpClientCallBackQuery );
                this.Device.messageCallOk =  "";
                this.HttpClientCallBackQuery.post(url, requestHeaders, data_json, items, this.itemsEncoding);
                // action
                data.text = number;
                r = this._callback_login ( items, data, number );
                if ( r )
                {   // correct pin + ok
                    url = this.telegramUrl + this.Setup.botToken + this.endpointSendMessage;
                    requestHeaders = this._build_header ( "json", this.HttpClientSendMessage );
                    QMedialon.SetTimeout( function() {this._main_menu ( items, data ); }, 100);
                }
            } 
            else
            {   // check user is already logged
                if ( this._user_log_already ( data.chat_id ) )
                {   // main menu keyboard?
                    if ( number >= 20 && number < 30 )
                    {   // post user feedback - empty text - only to remove "clock" in button faster
                        data.text = "";
                        data_json = JSON.stringify( data );
                        url = this.telegramUrl + this.Setup.botToken + this.endpointAnsCallbackQuery;
                        requestHeaders = this._build_header ( "json", this.HttpClientCallBackQuery );
                        this.Device.messageCallOk =  "";
                        this.HttpClientCallBackQuery.post(url, requestHeaders, data_json, items, this.itemsEncoding);
                        // action
                        data.text = number;
                        this._callback_main_menu ( items, data, number );
                    }
                }
                else
                {   // user not logged
                    requestHeaders = this._build_header ( "json", this.HttpClientSendMessage );
                    url = this.telegramUrl + this.Setup.botToken + this.endpointSendMessage;
                    this._start ( items, data );
                }
            } 
            
        }
    },
    //************************************************************************
    _start: function ( items, data ) {
        var requestHeaders = this._build_header ( "json", this.HttpClientSendMessage );
        var url = this.telegramUrl + this.Setup.botToken + this.endpointSendMessage;
        data.text = "Welcome *" + data.from_first_name + "* !\nPlease, to continue click\n/login"
        var data_json = JSON.stringify( data );
        this.HttpClientSendMessage.post(url, requestHeaders, data_json, items, this.itemsEncoding);
    },   
    //************************************************************************
    _login: function ( items, data ) {
        var requestHeaders = this._build_header ( "json", this.HttpClientSendMessage );
        var url = this.telegramUrl + this.Setup.botToken + this.endpointSendMessage;
        data.text = this.messageLogin;
        data.reply_markup = this._build_inline_keyboard_login();
        var data_json = JSON.stringify( data );
        this.HttpClientSendMessage.post(url, requestHeaders, data_json, items, this.itemsEncoding);
    },
    //************************************************************************
   _main_menu: function ( items, data ) {
        var requestHeaders = this._build_header ( "json", this.HttpClientSendMessage );
        var url = this.telegramUrl + this.Setup.botToken + this.endpointSendMessage;
        // check user is already logged
        if ( this._user_log_already ( data.chat_id ) )
        {   data.text = "Main Menu.\nclick to select";
            data.reply_markup = this._build_inline_keyboard_main_menu();
            var data_json = JSON.stringify( data );
            this.HttpClientSendMessage.post(url, requestHeaders, data_json, items, this.itemsEncoding);
        }
        else
            // user not logged
            this._start ( items, data );
    },
    //************************************************************************
    _unknown: function ( items, data, text ) {
        var requestHeaders = this._build_header ( "json", this.HttpClientSendMessage );
        var url = this.telegramUrl + this.Setup.botToken + this.endpointSendMessage;
        data.text = 'Unrecognized " ' + text + ' "\nSay what?\n/start';
        var data_json = JSON.stringify( data );
        this.HttpClientSendMessage.post(url, requestHeaders, data_json, items, this.itemsEncoding);
    },
    //*************************************************************************
    //  5b. Script Private Functions - PARSE CALLBACK QUERYS
    //*************************************************************************
    // PARSE CALLBACK FROM KEYBOARD LOGIN
    _callback_login: function ( items, data, number ) {
        var url, requestHeaders;
        //---------------------------------------------------------------------
        // if is comming from an old login keyboard
        if ( this.Device.loginMessage_id == 0 )
        {   // launch new one
            url = this.telegramUrl + this.Setup.botToken + this.endpointSendMessage;
            requestHeaders = this._build_header ( "json", this.HttpClientSendMessage );
            this._login( items, data );
            return;
        }
        //---------------------------------------------------------------------
        // which button
        data.message_id = this.Device.loginMessage_id;
        var len = this.Device.pin_string.length;
        var answer = 0;
        if ( number < 10 )
        {   if ( len < this.len_pin )
            {   this.Device.pin_string = this.Device.pin_string + number.toString();
                len++;
            }
            else
            {   this.Device.pin_string = "";
                len = 0;                // error => clear
            }
            answer = 1;
        }
        else 
        {   if ( number == 10 )         // clear
            {   len = 0;
                answer = 1
            }
            else if ( number == 11 )    // ok
            {   if ( len == this.len_pin )
                {   // check pin
                    if ( this.Device.pin_string == this.Setup.pin_number )
                        answer = 2;     // pin ok
                    else
                        answer = 3      // pin error
                }
                else
                {   len = 0;
                    answer = 1
                }
            }
            this.Device.pin_string = "";
        }
        //---------------------------------------------------------------------
        // answer
        var text = "";
        var r = 0;
        switch ( answer )
        {   case 0:
                return;
            case 1:
                for ( var i= 0; i<this.len_pin; i++ )
                {   if ( len > i )
                        text = text + '* ';
                    else
                        text = text + '_ ';
                }
                data.text = "Please write your " +  this.len_pin + " digits pin\n" + text;
                data.reply_markup = this._build_inline_keyboard_login();
                break;
            case 2:
                data.text = "Login Successful";
                data.reply_markup = {inline_keyboard: []};      // keyboard off
                this.Device.loginMessage_id = 0;
                this._user_log_in( data );
                r = 1;
                break;
            case 3:
                data.text = "Error - Try again";
                data.reply_markup = this._build_inline_keyboard_login();
                break;
        }
        url = this.telegramUrl + this.Setup.botToken + this.endpointeditMessageText;
        requestHeaders = this._build_header ( "json", this.HttpClientEditMessageText );
        var data_json = JSON.stringify( data );
        this.Device.messageEditOk = "";
        this.HttpClientEditMessageText.post(url, requestHeaders, data_json, items, this.itemsEncoding);
        return r;
    },
    //*************************************************************************
    // PARSE CALLBACK FROM KEYBOARD MAIN MENU
    _callback_main_menu: function ( items, data, number ) {
        var filename = "";
        // which button
        switch ( number )
        {   case 20:
                data.text = this._medialon_status();
                break;
            case 21:
                data.text = "Video Task. ToDo\n/main_menu";
                break;
            case 22:
                data.text = "Audio Task. ToDo\n/main_menu";
                break;
            case 23:
                data.text = "Light Task. ToDo\n/main_menu";
                break;
            case 24:
                data.text = "Log File Download.\n/main_menu";
                filename = "log_file.txt";
                break;
        }
        var data_json = JSON.stringify( data );
        var url = this.telegramUrl + this.Setup.botToken + this.endpointSendMessage;
        var requestHeaders = this._build_header ( "json", this.HttpClientSendMessage );
        this.HttpClientSendMessage.post(url, requestHeaders, data_json, items, this.itemsEncoding);
        if ( filename != "" )
        {   var textAsFile = this.Device.recvMessgList;
            QMedialon.SetTimeout( function() {this._send_document( data.chat_id, filename, textAsFile ); }, 500);
        }
    },
    //************************************************************************
    //  5b. Script Private Functions - OTHER FUNCTIONS
    //************************************************************************
    _medialon_status: function () {
        var varName, value, index;
        var text = "Medialon Status:\n";
        for ( var i = 0; i < this.medialonVars.length; i++)
        {   text = text + this.medialonVars[i];
            varName = this.medialonDevice + "." + this.medialonVars[i];
            value = QMedialon.GetValueAsString( varName );
            if ( value != "")
                text = text + " = " + value + "\n";
            else
                text = text + " = unknown\n";
            index = text.indexOf("\r\n\n");
            if (  index != -1 )
               text = text.slice(0, -1);
        }
        text = text + "/main_menu";
        return text;
    },
    //************************************************************************
    _user_log_in: function ( data ) {
        var current_id = data.chat_id;
        var id = 0;
        // is already in the users log ?
        for ( var i = 0; i < this.usersLog.length; i++ )
        {   if ( this.usersLog[i].id == current_id )
            {   id = 999;
                break;
            }
        }
        if ( id == 0 )
        {   var new_log = {};
            new_log.id = current_id;
            new_log.timestamp = this.secondsCounter;
            this.usersLog.push( new_log );
        }
        // debug
        this.Device.userLogJson = JSON.stringify(this.usersLog);
    },
    //************************************************************************
    // USERS LOG OUT BY TIMEOUT - AFTER 60 SECONDS NOT ACTIVE
    _user_log_out: function () {
        for ( var i = 0; i < this.usersLog.length; i++ )
        {   if ( this.secondsCounter > ( this.usersLog[i].timestamp + 60 ) )
            {   this.usersLog.splice(i,1);
                break;
            }
        }  
        // debug
        this.Device.userLogJson = JSON.stringify(this.usersLog); 
    },
    //************************************************************************
    // USER IS ALREADY LOGGED?
    _user_log_already: function ( chatId ) {
        for ( var i = 0; i < this.usersLog.length; i++ )
        {   if ( this.usersLog[i].id == chatId )
            {   // yes
                this.usersLog[i].timestamp = this.secondsCounter;
                return 1;
            }
        } 
        // no
        return 0;  
    },
    //************************************************************************
    // CLEAR SAME DEVICE VARIABLES
    _clear_device_variables: function () {
        this.Device.lastStatusCode = "";
        this.Device.lastError = "";
        this.Device.lastUpdateRecv = "";
        this.Device.lastGetMeRecv = "";
        this.Device.lastSentRecv = "";
        this.Device.lastDocRecv = "";
        this.Device.lastCallbackRecv =  "";
        this.Device.lastEditMesTextRecv = "",
        this.Device.messageText = "";
        this.Device.messageUserId = "";
        this.Device.messageUserName = "";
        this.Device.messageUpdateOk =  "";
        this.Device.messageGetMeOk =  "";
        this.Device.messageSentOk =  "";
        this.Device.messageDocOk =  "";
        this.Device.messageCallOk =  "";
        this.Device.messageEditOk = "";
        this.Device.messageRcv =  "";
    },
    //************************************************************************
    //  BUILD SOME DEVICE VARIABLES
    _build_device_variables: function ( result ) {
        // update last device vars
        this.Device.messageText = result.message.text;
        this.Device.messageUserId = result.message.from.id;
        this.Device.messageUserName = result.message.from.first_name;
        var time = QMedialon.GetValueAsString( "Manager.CurrentTime" );
        var date = QMedialon.GetValueAsString( "Manager.CurrentDate" );
        // in one string
        this.Device.messageRcv = + this.Device.messageUserId + " - "
            + this.Device.messageUserName + " - " + date + " " + time + " - "
            + this.Device.messageText;
        // add string to the array
        this.recvMessgArray.push( this.Device.messageRcv );
        // build device received messages list
        this.Device.recvMessgList = this.recvMessgArray.join("\r\n");
        this.Device.recvMessgList += "\r\n";
    },
    //************************************************************************
    //  BUILD HEADERS
    _build_header: function ( type, clientObject, len ) {
        var requestHeaders = "";
        var contentType = "";
        if ( type == "urlencoded" )
        {   contentType = "application/x-www-form-urlencoded";
            requestHeaders = clientObject.addHeader( requestHeaders, "Content-Type", contentType );
        }
        else if ( type == "json" )
        {   contentType = "application/json";
            requestHeaders = clientObject.addHeader( requestHeaders, "Content-Type", contentType );
        }   
        else if ( type == "form-data" )
        {   contentType = "multipart/form-data; boundary=" + this.boundary;
            requestHeaders = clientObject.addHeader( requestHeaders, "Content-Type", contentType );
            requestHeaders = clientObject.addHeader( requestHeaders, "Content-Length", len );
        }
        return requestHeaders;
    },
    //************************************************************************
    // LOGIN INLINE KEYBOARD
    _build_inline_keyboard_login: function () {
        var but_0 = { "text": "0", "callback_data": "#0" };
        var but_1 = { "text": "1", "callback_data": "#1" };
        var but_2 = { "text": "2", "callback_data": "#2" };
        var but_3 = { "text": "3", "callback_data": "#3" };
        var but_4 = { "text": "4", "callback_data": "#4" };
        var but_5 = { "text": "5", "callback_data": "#5" };
        var but_6 = { "text": "6", "callback_data": "#6" };
        var but_7 = { "text": "7", "callback_data": "#7" };
        var but_8 = { "text": "8", "callback_data": "#8" };
        var but_9 = { "text": "9", "callback_data": "#9" };
        var but_clear = { "text": "Clear", "callback_data": "#10" };
        var but_ok = { "text": "Ok", "callback_data": "#11" };
        var row_1 = [ but_1, but_2, but_3 ];
        var row_2 = [ but_4, but_5, but_6 ];
        var row_3 = [ but_7, but_8, but_9 ];
        var row_4 = [ but_clear, but_0, but_ok ];
        var keyboard = {};
        keyboard.inline_keyboard = [];
        keyboard.inline_keyboard[0] = row_1; 
        keyboard.inline_keyboard[1] = row_2;
        keyboard.inline_keyboard[2] = row_3;
        keyboard.inline_keyboard[3] = row_4;
        return JSON.stringify(keyboard);
    },
    //************************************************************************
    //  MAIN MENU INLINE KEYBOARD
    _build_inline_keyboard_main_menu: function () {
        var but_1 = { "text": "Medialon Status", "callback_data": "#20" };
        var but_2 = { "text": "Video Task", "callback_data": "#21" };
        var but_3 = { "text": "Audio Task", "callback_data": "#22" };
        var but_4 = { "text": "Light Task", "callback_data": "#23" };
        var but_5 = { "text": "Log File Download", "callback_data": "#24" };
        var row_1 = [but_1, but_2];
        var row_2 = [but_3, but_4];
        var row_3 = [but_5];
        var keyboard = {}; 
        keyboard.inline_keyboard = [];
        keyboard.inline_keyboard[0] = row_1;  
        keyboard.inline_keyboard[1] = row_2;
        keyboard.inline_keyboard[2] = row_3;  
        return JSON.stringify(keyboard);
    },
    //************************************************************************
    //  SETUP HTTP CLIENTS - ONE FOR EACH FUNCTION THAT MAKES A POST
    _setup_http_clients: function () {
        // the client objects
        this.HttpClientGetUpdates = QMedialon.CreateHTTPClient();
        this.HttpClientSendMessage = QMedialon.CreateHTTPClient();
        this.HttpClientSendDocument = QMedialon.CreateHTTPClient();
        this.HttpClientGetMe = QMedialon.CreateHTTPClient();
        this.HttpClientCallBackQuery =  QMedialon.CreateHTTPClient();
        this.HttpClientEditMessageText = QMedialon.CreateHTTPClient();
        // the call backs
        this.HttpClientGetUpdates.on( 'response', this._response_get_updates );
        this.HttpClientSendMessage.on( 'response', this._response_send_message );
        this.HttpClientSendDocument.on( 'response', this._response_send_document );
        this.HttpClientGetMe.on( 'response', this._response_get_me );
        this.HttpClientCallBackQuery.on( 'response', this._response_send_callback );
        this.HttpClientEditMessageText.on( 'response', this._response_edit_message_text ); 
    },
    //************************************************************************
    // 5b. Script Private Functions - STARTUP FUNCTION
    //************************************************************************
    _mStart : function() {
        this._setup_http_clients();
        // startup variables
        this._clear_device_variables();
        this.longPoll = this.answerTimeOutSeconds - 5;  // 5 seconds less than get_update timeout
        this.len_pin = this.Setup.pin_number.length;
        var dashes = "";
        for ( var i = 0; i < this.len_pin; i++ ) 
            dashes = dashes + "_ ";
        // remove the last space in var dashes - important, telegram remove them
        this.messageLogin = "Please write your " + this.len_pin + " digits pin\n" + dashes.slice(0, -1); 
        this.Device.loginMessage_id =  0;
        this.Device.pin_string =  "";
        // wait for 1 second to start
        QMedialon.SetTimeout(this._first_task, 1000);
    },
    //*************************************************************************
// 6. Script Ends
}) 