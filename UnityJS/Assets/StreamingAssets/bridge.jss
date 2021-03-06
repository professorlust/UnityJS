/*
 * bridge.js
 * Unity3D / JavaScript Bridge
 * Don Hopkins, Ground Up Software.
 */


////////////////////////////////////////////////////////////////////////
// Globals


var globals = {
    driver: "None",
    spreadsheetID: "",
    configuration: "world",
    nextID: 0,
    objects: {},
    callbacks: {},
    consoleLog: null,
    startedUnity: false,
    startedJS: false,
    pollCount: 0,
    jsToUnityEventQueue: [],
    jsToUnityEventCount: 0,
    jsToUnityEventBytes: 0,
    jsToUnityEventLog: "",
    unityToJSEventCount: 0,
    unityToJSEventBytes: 0,
    unityToJSEventLog: "",
    content: null,
    updateContent: false,
    tagged: [],
    tags: []
};


////////////////////////////////////////////////////////////////////////
// Debugging


function Tag(obj, tag)
{
    var i = globals.tagged.indexOf(obj);
    if (i == -1) {
        console.log("TAG NEW", globals.tagged.length, tag, TagShow(obj, tag));
        globals.tagged.push(obj);
        globals.tags.push(tag);
    } else {
        console.log("TAG OLD", i, globals.tags[i], TagShow(obj, tag));
    }
}


function TagShow(obj, tag)
{
    var str = '';
    var keys = Object.keys(obj);
    keys.sort();
    for (var i in keys) {
        var k = keys[i];
        var val = obj[k];
        str += k + ': ';
        var tagIndex = globals.tagged.indexOf(val);
        if (tagIndex != -1) {
            str += 'TAG ' + tagIndex + ' ' + globals.tags[tagIndex] + ': ';
        }
        if (val && (typeof val === 'object') && (val.constructor === Array)) {
            str += 'Array(' + val.length + '): [';
            for (var j in val) {
                if (j > 0) {
                    str += ', ';
                }
                str += val[j];
            }
            str += ']';
        } else if (val && (typeof val == 'object') && (val.constructor === Object)) {
            var keys2 = Object.keys(val);
            keys2.sort();
            str += 'Object(' + keys2.length + '): {';
            for (var jj in keys2) {
                if (jj > 0) {
                    str += ', ';
                }
                str += keys2[jj];
            }
            str += '}';
        } else {
            str += JSON.stringify(val);
        }
        str += '\n';
    }
    return obj + '(' + keys.length + '):\n' + str;
}


////////////////////////////////////////////////////////////////////////


function StartBridge(driver, spreadsheetID, configuration)
{
    console.log("bridge.js: StartBridge: begin driver " + driver + " spreadsheetID: " + spreadsheetID + " configuration: " + configuration);

    if (globals.startedUnity) {
        console.log("bridge.js: StartBridge: called again but ignored");
        return;
    }

    globals.driver = driver || "Unknown";
    globals.spreadsheetID = spreadsheetID || "";
    globals.configuration = configuration || "world";

    SendEvent({
        event: 'StartedJS'
    });

    globals.startedUnity = true;
    globals.startedJS = true;

    CreateObjects();

    //console.log("bridge.js: StartBridge: end");
}


////////////////////////////////////////////////////////////////////////
// Bridge Utilities


function MakeID(kind)
{
    // We don't want slashes in the object ids.
    kind = kind.replace(/\//g, '_');
    return kind + "_" + globals.nextID++;
}


function EscapeText(text)
{
    return text.replace("&", "&amp;")
               .replace("<", "&lt;")
               .replace(">", "&gt;")
               .replace("\\", "\\\\");
}


function Dump(obj)
{
    return EscapeText(JSON.stringify(obj, null, 4));
}


// SearchDefault searches a list of dictionaries for
// a key, the its value in the first dictionary that
// contains it, or returns a default value if it's
// not found. The first argument is the key, the next
// one or more arguments are the dictionaries to search,
// and the last argument is the default value. 
// So there must be at least three arguments.
function SearchDefault()
{
    //console.log("bridge.js: SearchDefault: key:", arguments[0], "arguments:", arguments);

    var argumentCount = arguments.length;

    if (argumentCount < 3) {
        console.log("bridge.js: SearchDefault: Called with nonsensically too few arguments! Should be: key, object..., default", arguments);
        return null;
    }

    // The first argument is the key to search for.
    var key = arguments[0];

    // Search the rest of arguments for the key, except for the last one.
    // The last argument is the default value so don't search that one.

    for (var argumentIndex = 1;
         argumentIndex < (argumentCount - 1);
         argumentIndex++) {

        var dict = arguments[argumentIndex];

        // Skip null dicts, for convenience.
        if (!dict) {
            continue;
        }

        var value = dict[key];

        if (value !== undefined) {
            // Found it!
            return value;
        }

    }

    // Didn't find it, so return the default.
    return arguments[argumentCount - 1];

}


function CreatePrefab(template)
{
    if (template == null) {
        console.log("bridge.js: CreatePrefab: template is null");
        return null;
    }

    //console.log("bridge.js: CreatePrefab: template:", JSON.stringify(template, null, 4));

    // obj, prefab, component, preEvents, parent, worldPositionStays, update, interests, postEvents

    var obj = template.obj || {};
    var prefab = template.prefab || null;
    var component = template.component || null;
    var preEvents = template.preEvents || null;
    var parent = template.parent || null;
    var worldPositionStays = template.worldPositionStays;
    var update = template.update || null;
    var interests = template.interests || null;
    var postEvents = template.postEvents || null;

    //console.log("CreatePrefab", "obj", obj, "prefab", prefab, "component", component, "preEvents", preEvents, "parent", parent, "worldPositionStays", worldPositionStays, "update", update, "interests", JSON.stringify(interests), "postEvents", postEvents);

    var remoteInterests = {};
    if (interests) {
        for (var eventName in interests) {
            var interest = interests[eventName];
            var remoteInterest = {};
            remoteInterests[eventName] = remoteInterest;
            for (var key in interest) {
                if (key == 'handler') {
                    continue;
                }
                remoteInterest[key] = interest[key];
            }
        }
    }

    //console.log("CreatePrefab", "remoteInterests", JSON.stringify(remoteInterests));

    var id = MakeID(prefab || 'GameObject');

    obj.id = id;
    obj.interests = interests;

    globals.objects[id] = obj;

    var data = {
        id: id
    };

    if (prefab && prefab.length) {
        data.prefab = prefab;
    }

    if (component && component.length) {
        data.component = component;
    }

    if (preEvents && preEvents.length) {
        data.preEvents = preEvents;
    }

    if (parent && parent.length) {
        data.parent = parent;
    }

    if (worldPositionStays !== undefined) {
        data.worldPositionStays = !!worldPositionStays;
    }

    if (update && Object.keys(update).length) {
        data.update = update;
    }

    if (remoteInterests && Object.keys(remoteInterests).length) {
        data.interests = remoteInterests;
    }

    if (postEvents && postEvents.length) {
        data.postEvents = postEvents;
    }

    SendEvent({
        event: 'Create',
        data: data
    });

    return obj;
}


function DestroyObject(obj)
{
    if (obj == null) {
        console.log("bridge.js: DestroyObject: obj is null", JSON.stringify(query));
        return;
    }

    SendEvent({
        event: 'Destroy',
        id: obj.id
    });
}


function UpdateObject(obj, data)
{
    if (obj == null) {
        console.log("bridge.js: UpdateObject: obj is null", "data", JSON.stringify(data));
        return;
    }

    SendEvent({
        event: 'Update',
        id: obj.id,
        data: data
    });
}


function AnimateObject(obj, data)
{
    if (obj == null) {
        console.log("bridge.js: AnimateObject: obj is null", "data", JSON.stringify(data));
        return;
    }

    //console.log("bridge.js: AnimateObject: data:", JSON.stringify(data, null, 4));

    SendEvent({
        event: 'Animate',
        id: obj.id,
        data: data
    });
}


function QueryObject(obj, query, callback)
{
    if (obj == null) {
        console.log("bridge.js: QueryObject: obj is null", "query", JSON.stringify(query), "callback", callback);
        return;
    }

    var callbackID = callback && MakeCallbackID(obj, callback, true);
    var data = {
        query: query,
        callbackID: callbackID
    };

    SendEvent({
        event: 'Query',
        id: obj.id,
        data: data
    });
}


function UpdateInterests(obj, data)
{
    if (obj == null) {
        console.log("bridge.js: UpdateInterests: obj is null", "data", data);
        return;
    }

    SendEvent({
        event: 'UpdateInterests',
        id: obj.id,
        data: data
    });
}


function MakeCallbackID(obj, callback, oneTime)
{
    var callbackID = MakeID("Callback");

    globals.callbacks[callbackID] = function (data) {
        //console.log("bridge.js: MakeCallbackID:", "callback:", callback, "callbackID:", callbackID, "data:", data);
        callback(data);
        if (oneTime) {
            ClearCallback(callbackID);
        }
    };

    return callbackID;
}


function InvokeCallback(callbackID, data)
{
    var callback = globals.callbacks[callbackID];
    if (callback == null) {
        console.log("bridge.js: InvokeCallback: undefined callbackID:", callbackID);
        return;
    }

    callback(data);
}


function ClearCallback(callbackID)
{
    delete globals.callbacks[callbackID];
}


function SendEvent(ev)
{
    var evString = JSON.stringify(ev);

    //console.log("======== SendEvent", evString);

    globals.jsToUnityEventCount++;
    globals.jsToUnityEventBytes += evString.length;
    //globals.jsToUnityEventLog += ev.event + " ";

    switch (globals.driver) {

        case "WebView":
            window.webkit.messageHandlers.bridge.postMessage(evString);
            break;

        case "WebGL":
            globals.jsToUnityEventQueue.push(evString);
            if (!globals.startedUnity) {
                FlushJSToUnityEventQueue();
                UpdateContent();
            }
            break;

        case "CEF":
            globals.jsToUnityEventQueue.push(evString);
            if (!globals.startedUnity) {
                FlushJSToUnityEventQueue();
                UpdateContent();
            }
            break;

    }

}


function DistributeEvents(evList, evListStringLength)
{
    globals.pollCount++;
    if (evList != null) {
        globals.unityToJSEventCount += evList.length;
        globals.unityToJSEventBytes += evListStringLength;

        for (var i = 0, n = evList.length; i < n; i++) {
            var ev = evList[i];

            globals.unityToJSEventLog += ev['event'] + " ";

            DistributeEvent(ev);
        }

    }

    FlushJSToUnityEventQueue();
    UpdateContent();
}


function UpdateContent()
{
    if (!globals.updateContent) {
        return;
    }

    if (globals.content == null) {
        globals.content = document.getElementById('content');
    }
    if (globals.content != null) {
        globals.content.innerText = 
            "Polls: " + globals.pollCount + 
            "\nJS=>Unity Events: " + globals.jsToUnityEventCount + " Bytes: " + globals.jsToUnityEventBytes +
            "\n" + globals.jsToUnityEventLog +
            "\nUnity=>JS Events: " + globals.unityToJSEventCount + " Bytes: " + globals.unityToJSEventBytes +
            "\n" + globals.unityToJSEventLog;
    }
}


function DistributeEvent(ev)
{
    var eventName = ev.event;
    var id = ev.id;
    var data = ev.data;

    switch (eventName) {

        case "StartedUnity":

            //console.log("bridge.js: DistributeEvent: StartedUnity:", ev);

            //StartBridge();

            break;

        case "Callback":

            //console.log("bridge.js: DistributeEvent: InvokeCallback:", id, data);

            InvokeCallback(id, data);

            break;

        default:

            var obj = (id && globals.objects[id]) || null;
            if (obj == null) {
                console.log("bridge.js: DistributeEvent: undefined object id: " + id + " eventName: " + eventName + " data: " + data);
                return;
            }

            var interests = obj['interests'];
            if (!interests) {
                //console.log("bridge.js: DistributeEvent: no interests for object id: " + id + " eventName: " + eventName + " data: " + data);
                return;
            }

            var interest = interests[eventName];
            if (interest) {
                interest.handler(obj, data);
            } else if ((eventName != "Created") &&
                       (eventName != "Destroyed")) {
                console.log("bridge.js: DistributeEvent: no interest for object id: " + id + " eventName: " + eventName + " data: " + data);
            }

            if ((eventName == "Destroyed") &
                (obj != null)) {
                //console.log("bridge.js: DistributeEvent: Destroy", "id", ev.id, "obj", obj);
                delete globals.objects[id];
            }

            break;

        }
}


function EvaluateJS(js)
{
    //console.log("bridge.js: EvaluateJS: js:", js);

    try {
        eval(js);
    } catch (error) {
        console.log("bridge.js: EvaluateJS: error:", error, "js:", js);
    }
}


function ConsoleLog()
{
    if (!globals.consoleLog) {
        return;
    }

    var parts = [];
    for (var i = 0, n = arguments.length; i < n; i++) {
        parts.push("" + arguments[i]);
    }

    var data = {
        line: parts.join(" ")
    };

    SendEvent({
            event: "Log",
            data: data
        });

}


function PollForEventsAndroid()
{
    // TODO
}


function PollForEvents()
{
    if (globals.jsToUnityEventQueue.length == 0) {
        return "";
    }

    var evListString = globals.jsToUnityEventQueue.join(',');
    //console.log("bridge.js: PollForEvents: queue length: " + globals.jsToUnityEventQueue.length + " evListString length: " + evListString.length);

    globals.jsToUnityEventQueue = [];

    return evListString;
}


function FlushJSToUnityEventQueue()
{
    if (globals.jsToUnityEventQueue.length == 0) {
        return null;
    }

    var evListString = globals.jsToUnityEventQueue.join(',');
    //console.log("bridge.js: FlushJSToUnityEventQueue: queue length: " + globals.jsToUnityEventQueue.length + " evListString length: " + evListString.length);

    globals.jsToUnityEventQueue = [];

    SendEventList(evListString);
}


function SendEventList(evListString)
{ 
    if (window.unityAsync) {

        // Unity Editor Runtime

        unityAsync({
            className: "Bridge",
            funcName: "SendEventList",
            funcArgs: [evListString]
        });

    } else {

        // WebGL Runtime

        window.bridge._UnityJS_SendJSToUnityEvents(
            evListString);

    }
}


////////////////////////////////////////////////////////////////////////
// Canvas Utilities


function SetJS(text)
{
    UpdateObject(globals.canvas, {
        "transform:Panel/transform:JSField/component:TMPro.TMP_InputField/text": text
    });
}


function SetOutput(text)
{
    UpdateObject(globals.canvas, {
        "transform:Panel/transform:OutputField/component:TMPro.TMP_InputField/text": text
    });
}


function SetText(text)
{
    UpdateObject(globals.canvas, {
        "transform:Panel/transform:TextField/component:TMPro.TMP_InputField/text": text
    });
}


////////////////////////////////////////////////////////////////////////
// TextOverlays Utilities


function SetGridText(topLeft, top, topRight, left, center, right, bottomLeft, bottom, bottomRight)
{
    //console.log("SetGridText", topLeft, top, topRight, left, center, right, bottomLeft, bottom, bottomRight);
    UpdateObject(globals.textOverlays, {
        "topLeftText/text": topLeft || '',
        "topText/text": top || '',
        "topRightText/text": topRight || '',
        "leftText/text": left || '',
        "centerText/text": center || '',
        "rightText/text": right || '',
        "bottomLeftText/text": bottomLeft || '',
        "bottomText/text": bottom || '',
        "bottomRightText/text": bottomRight || ''
    });
}


function SetCenterText(center)
{
    SetGridText(null, null, null, null, center, null, null, null, null);
}


function ShowObjectInfo(obj)
{
    if (obj == null) {
        SetGridText();
    } else {
        SetGridText(
            "\n<size=30%>" + Dump(obj),
            "Info for Object ID:\n" + obj.id);
    }
}


function CreateOverlayText(update)
{
    var overlayText = CreatePrefab({
        prefab: 'Prefabs/OverlayText',
        update: update,
        parent: 'object:' + globals.textOverlays.id + '/overlay',
        worldPositionStays: false
    });
}


////////////////////////////////////////////////////////////////////////
// Object creation utilities.


function CreateObjects()
{
    CreateInterface();
    CreateCanvas();
}


function CreateInterface()
{

    globals.light = CreatePrefab({
        obj: {
            doNotDelete: true
        },
        prefab: 'Prefabs/Light'
    });

    globals.camera = CreatePrefab({
        obj: {
            doNotDelete: true
        },
        prefab: 'Prefabs/Camera'
    });

    globals.eventSystem = CreatePrefab({
        obj: {
            doNotDelete: true
        },
        prefab: 'Prefabs/EventSystem'
    });

    globals.textOverlays = CreatePrefab({
        obj: {
            doNotDelete: true
        },
        prefab: 'Prefabs/TextOverlays'
    });

}


function CreateCanvas()
{
    globals.canvas = CreatePrefab({
        obj: {
            doNotDelete: true
        },
        prefab: 'Prefabs/TestCanvas'
    });

    var canvasRef = 'object:' + globals.canvas.id;

    globals.buttonEval = CreatePrefab({
        obj: {
            doNotDelete: true
        },
        prefab: 'Prefabs/ToolbarButton',
        parent: canvasRef + '/transform:Panel/transform:ButtonPanel',
        update: {
            'label/text': 'Eval'
        },
        interests: {
            Click: {
                query: {
                    js: canvasRef + '/transform:Panel/transform:JSField/component:TMPro.TMP_InputField/text'
                },
                handler: function(obj, results) {
                    console.log("Canvas: button: Eval: js: " + results.js);
                    var result = eval(results.js);
                    SetOutput("" + results);
                }
            }
        }
    });

    globals.buttonFoo = CreatePrefab({
        obj: {
            doNotDelete: true
        },
        prefab: 'Prefabs/ToolbarButton',
        parent: canvasRef + '/transform:Panel/transform:ButtonPanel',
        update: {
            'label/text': 'Foo'
        },
        interests: {
            Click: {
                query: {
                    text: 'object:' + globals.canvas.id + '/transform:Panel/transform:TextField/component:TMPro.TMP_InputField/text'
                },
                handler: function(obj, results) {
                    console.log("Canvas: button: Foo: text: " + results.text);
                    SetOutput(JSON.stringify(results));
                }
            }
        }
    });

    globals.buttonBar = CreatePrefab({
        obj: {
            doNotDelete: true
        },
        prefab: 'Prefabs/ToolbarButton',
        parent: canvasRef + '/transform:Panel/transform:ButtonPanel',
        update: {
            'label/text': 'Bar'
        },
        interests: {
            Click: {
                query: {
                    text: 'object:' + globals.canvas.id + '/transform:Panel/transform:TextField/component:TMPro.TMP_InputField/text'
                },
                handler: function(obj, results) {
                    console.log("Canvas: button: Bar: text: " + results.text);
                    SetOutput(JSON.stringify(results));
                }
            }
        }
    });

}


////////////////////////////////////////////////////////////////////////
// Console log.


/*

if (!window.bridge) {
    window.bridge = {
        log: function() {}
    };
}

(function() {
    if (window.console && window.console.log) {
        window.consoleLogOld = window.consoleLogOld || window.console.log;
        console.log = function WrapConsoleLog() {
            ConsoleLog.apply(this, arguments);
            window.consoleLogOld.apply(this, arguments);
        };
    }  
})();

console.log("JavaScript console log initialized.");

*/


////////////////////////////////////////////////////////////////////////
