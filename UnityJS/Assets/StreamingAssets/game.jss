/*
 * game.js
 * Don Hopkins, Ground Up Software.
 */


////////////////////////////////////////////////////////////////////////
// Error Handler


window.onerror = function(message, source, line, column, error) {
    window.onerror = null;
    console.log("!!!!!!!!!!!!!!!! WINDOW.ONERROR", "MESSAGE", message, "LINE", line, "COLUMN", column, "SOURCE", source);
    console.trace();
};


////////////////////////////////////////////////////////////////////////
// Globals


globals.useApp = false;
globals.appURL = 'https://script.google.com/macros/s/AKfycbx6yinuIWLYE21Sd7UuEDxiJE3443gZutmhBhXVNo8Kk8lwAMc/exec';
globals.sheets = {};
globals.ranges = {};


////////////////////////////////////////////////////////////////////////


function CreateObjects()
{
    CreateKeyboardTracker();
    CreateBrowserRenderer();
    CreatePieTracker();
    LoadObjects();
}


function CreateKeyboardTracker()
{

    globals.keyboardTracker = CreatePrefab({
        prefab: 'Prefabs/KeyboardTracker', 
        obj: {
            doNotDelete: true
        },
        update: {
            tracking: true,
            inputStringTracking: true,
            keyEventTracking: true
        },
        interests: {
            InputString: {
                query: {
                    inputString: "inputString"
                },
                handler: function (obj, results) {
                    //console.log("KeyboardTracker: InputString: inputString: " + results.inputString);
                    TrackInputString(results.inputString);
                }
            },
            KeyEvent: {
                query: {
                    character: "keyEvent/character",
                    keyCode: "keyEvent/keyCode",
                    type: "keyEvent/type/method:ToString",
                    modifiers: "keyEvent/modifiers"
                    //shift: "keyEvent/shift",
                    //alt: "keyEvent/alt",
                    //control: "keyEvent/control",
                    //command: "keyEvent/command",
                    //capsLock: "keyEvent/capsLock",
                    //functionKey: "keyEvent/functionKey",
                    //numeric: "keyEvent/numeric",
                    //mousePosition: "keyEvent/mousePosition"
                },
                handler: function (obj, results) {
                    //console.log("KeyboardTracker: KeyEvent: results: " + JSON.stringify(results));
                    TrackKeyEvent(results);
                }
            }
        }
    });

}


function TrackInputString(inputString)
{
    //console.log("TrackInputString: inputString: " + inputString);
}


function TrackKeyEvent(results)
{
    //console.log("game.js: TrackKeyEvent: results: " + JSON.stringify(results));

    switch (results.keyCode) {

        case 'R':
            if ((results.type == "keyDown") && 
                (results.modifiers == "Control")) {

                console.log("game.js: TrackInputString: Ctrl-R: Reloading world...");
                ClearWorld();
                LoadObjects();

            }
            break;

    }

}


function CreateBrowserRenderer()
{

    var browserRenderer = null;


    function HandleIframeLoaded(ev)
    {
    }


    function Render(results)
    {
        browserRenderer.renderQueue.push(results);
        HandleRendering();
    }


    function HandleRendering()
    {
    }


    globals.browserRenderer = browserRenderer = CreatePrefab({
        prefab: 'Prefabs/BrowserRenderer', 
        obj: {
            doNotDelete: true,
            renderQueue: [],
            rendering: null,
            renderTimer: null
        },
        update: {
        },
        interests: {
            Render: {
                handler: function (obj, results) {
                    //console.log("game.js: BrowserRenderer: Render: obj:", obj, "results:", results);
                    Render(results);
                }
            }
        }
    });


}


function DrawToCanvas(params, drawer, success, error)
{
    var width = params.width;
    var height = params.height;
    var canvas = 
        d3.select('body')
            .append('canvas')
            .attr('width', width)
            .attr('height', height)
            .attr('style', 'display: none');
    var canvasNode =
        canvas.node();
    var context =
        canvasNode.getContext('2d');

    drawer(
        canvas,
        context,
        params,
        function() {
            var texture = null;
            switch (globals.driver) {

                case "WebGL":
                    var id = params.cache.backgroundSharedTextureID;
                    if (!id) {
                        params.cache.backgroundSharedTextureID = id = 
                            window.bridge._UnityJS_AllocateTexture(params.width, params.height);
                        //console.log("game.js: DrawToCanvas: WebGL: AllocateTexture: width: " + params.width + " height: " + params.height + " id: " + id);
                    }
                    var imageData =
                        context.getImageData(0, 0, params.width, params.height);
                    window.bridge._UnityJS_UpdateTexture(id, imageData);
                    texture = {
                        type: 'sharedtexture',
                        id: id
                    };
                    var uvRect = { x: 0, y: 0, width: 1, height: -1 };
                    success(texture, uvRect, params);
                    canvasNode.parentNode.removeChild(canvasNode);
                    break;

                default:
                    canvasNode.toBlob(function(blob) {
                        var reader = new FileReader();
                        reader.onload = function(e) {
                            var data = e.target.result;
                            var texture = {
                                type: 'datauri',
                                uri: data,
                                width: width,
                                height: height
                            };
                            var uvRect = { x: 0, y: 0, width: 1, height: 1 };
                            success(texture, uvRect, params);
                            canvasNode.parentNode.removeChild(canvasNode);
                        };
                        reader.onerror = reader.onabort = function(e) {
                            error(params);
                            canvasNode.parentNode.removeChild(canvasNode);
                        };
                        reader.readAsDataURL(blob);
                    });
                    break;

            }
        }, 
        function() {
            error(params);
            canvasNode.parentNode.removeChild(canvasNode);
        });

}


function CreatePieTracker()
{
}


function CreatePies()
{
}


function ClearWorld()
{
    var world = globals.world;

    for (var objectID in globals.objects) {

        var obj = globals.objects[objectID];

        if (obj.doNotDelete) {
            continue;
        }

        DestroyObject(obj);
    }

    globals.sheets = {};
    globals.ranges = {};
}


function LoadObjects()
{
    var startTime = new Date();

    function LoadedSheetsSuccess(data)
    {

        var endTime = new Date();
        var duration = endTime - startTime;

        console.log("game.js: LoadObjects: LoadSheetsSuccess: duration: " + duration);

        globals.spreadsheetName = data.name;
        globals.sheets = data.sheets;
        globals.ranges = data.ranges;

        //console.log("sheets", globals.sheets, "ranges", globals.ranges);

        if (!globals.sheets[globals.configuration]) {
            console.log("game.js: LoadObjects: Finished loading sheets, but configuration sheet '" + globals.configuration + "' was not loaded!");
            return;
        }

        var scope = SheetToScope(globals.sheets, globals.ranges, globals.configuration);
        globals.scope = scope;

        var error = scope.error;
        var world = scope.value;

        if (error) {
            console.log("game.js: LoadObjects: LoadSheetsSuccess: Error loading world. Error in sheetName:", scope.errorScope.errorSheetName, "row:", scope.errorScope.errorRow, "column:", scope.errorScope.errorColumn, "error:", error, "errorScope:", scope.errorScope);
        } else if (!world) {
            console.log("game.js: LoadObjects: LoadSheetsSuccess: Loaded world but it was null.", "scope:", scope);
        } else {
            globals.world = world;
            //console.log("game.js: LoadObjects: LoadSheetsSuccess: Loaded world:", world, "scope:", scope);
            CreateLoadedObjects();
        }

    }

    function LoadedSheetsError()
    {
        console.log("game.js: LoadObjects: LoadedSheetsError: Error loading sheets!");
    }

    if (globals.useApp) {
        LoadSheetsFromApp(globals.appURL, LoadedSheetsSuccess, LoadedSheetsError);
    } else {
        LoadSheets(gSheetsIndex, LoadedSheetsSuccess, LoadedSheetsError);
    }

}


function CreateLoadedObjects()
{
    //console.log("game.js: CreateLoadedObjects");

    var world = globals.world;

    if (world.createTemplatedObjects) {
        CreateTemplatedObjects();
    }

    if (world.createMap) {
        CreateMap();
    }

    if (world.createBlobs) {
        CreateBlobs();
    }

    if (world.createJsonsters) {
        CreateJsonsters();
    }

    if (world.createPies) {
        CreatePies();
    }

    if (world.createPlaces) {
        CreatePlaces();
    }

    if (world.createTests) {
        CreateTests();
    }

    if (world.createPrivate) {
        CreatePrivate();
    }

}


function CreateTemplatedObjects()
{
    var world = globals.world;
    var templatedObjectNames = world.templatedObjectNames;
    var templates = world.templates;

    for (var nameIndex = 0, nameCount = templatedObjectNames.length; 
         nameIndex < nameCount; 
         nameIndex++) {

        var name = templatedObjectNames[nameIndex];
        var template = templates[name];

        //console.log("game.js: CreateTemplatedObjects:", name, template, "nameIndex", nameIndex, "nameCount", nameCount);

        globals[name] = CreatePrefab(template);
    }
}


function CreateMap()
{
    var world = globals.world;
    var tiles = world.tiles;
    var hexes = world.prefabMap.hexes;
    var vegetation = world.prefabMap.vegetation;
    var rows = [];
    //var component = 'Tracker';
    var component = 'HexTile';

    world.rows = rows;

    var tileDX = tiles.tileDX + tiles.tileGapDX;
    var tileDY = tiles.tileDY + tiles.tileGapDY;

    var dx = tiles.tileColumns * tileDX * -0.5;
    var dy = tiles.tileRows * tileDY * -0.5;

    for (var y = 0; y < tiles.tileRows; y++) {
        var tileY =
            tiles.tileY + dy +
            (y * tileDY);
        var row = [];
        rows.push(row);

        for (var x = 0; x < tiles.tileColumns; x++) {

            (function (x, y, tileY) {

                var tileX =
                    tiles.tileX + dx +
                    ((y & 1) ? (tileDX * 0.5) : 0) +
                    (x * tileDX);

                var tileHeight = 14;

                var height =
                    Math.max(1, tiles.tileHeight[y][x]);

                var lift = 1;
                var tileZScale = 
                    height / tileHeight;
                var tileZ = 
                    height + lift;

                var prefabName =
                    hexes.dir + 
                    tiles.tileName[y][x];

                var materialName =
                    tiles.tileMaterial[y][x];

                var prefabs = [];

                var tilePrefab =
                    CreatePrefab({
                        prefab: prefabName, 
                        component: component,
                        obj: {
                            x: x,
                            y: y,
                            tileX: tileX,
                            tileY: tileY
                        }, 
                        update: {
                            "transform/localPosition": {x: tileX, y: tileZ, z: tileY},
                            "transform/localScale": {x: 0.01, y: 0.01, z: 0.01},
                            "transform/localRotation": {yaw: 90},
                            "component:Rigidbody/drag": 0.8,
                            "component:Rigidbody/mass": 10.0,
                            "component:Rigidbody/angularDrag": 0.5,
                            "component:Rigidbody/collisionDetectionMode": "ContinuousDynamic",
                            "component:Collider/sharedMaterial": "PhysicMaterials/HighFrictionLowBounce",
                            "component:MeshRenderer/materials": [materialName, materialName, materialName],
                            "dragTracking": true
                        }, 
                        interests: {
                            MouseDown: {
                                query: {
                                    position: "transform/localPosition"
                                },
                                handler: function(obj, results) {
                                    //console.log("MouseDown on Hex", "x", obj.x, "y", obj.y, "position", results.position, "prefabName", obj.prefabName);
                                    if (obj.onMouseDown) obj.onMouseDown(obj, results);
                                }
                            },
                            DragStart: {
                                query: {
                                    position: "transform/localPosition"
                                },
                                handler: function(obj, results) {
                                    //console.log("DragStart on Hex", "x", obj.x, "y", obj.y, "position", results.position, "prefabName", obj.prefabName);
                                    if (obj.onDragStart) obj.onDragStart(obj, results);
                                }
                            },
                            DragMove: {
                                query: {
                                    position: "transform/localPosition"
                                },
                                handler: function(obj, results) {
                                    //console.log("DragMove on Hex", "x", obj.x, "y", obj.y, "position", results.position, "prefabName", obj.prefabName);
                                    if (obj.onDragMove) obj.onDragMove(obj, results);
                                }
                            },
                            DragStop: {
                                query: {
                                    position: "transform/localPosition"
                                },
                                handler: function(obj, results) {
                                    //console.log("DragStop on Hex", "x", obj.x, "y", obj.y, "position", results.position, "prefabName", obj.prefabName);
                                    if (obj.onDragStop) obj.onDragStop(obj, results);
                                }
                            }
                        },
                        postEvents: [
                            {
                                event: 'Animate',
                                data: [
                                    {
                                        command: 'scale',
                                        to: {x: 1, y: tileZScale, z: 1},
                                        time: 1
                                    }
                                ]
                            }
                        ]
                    });

                prefabs.push(tilePrefab);

                if (world.makeVegetation) {

                    var vegPrefabName =
                        vegetation.dir +
                        tiles.tileVegetation[y][x];

                    var vegPrefab =
                        CreatePrefab({
                            obj: {
                                x: x,
                                y: y,
                                tileX: tileX,
                                tileY: tileY
                            }, 
                            prefab: vegPrefabName, 
                            parent: 'object:' + tilePrefab.id,
                            update: {
                                "transform/localPosition": {
                                    x: tileX, 
                                    y: tileZ, 
                                    z: tileY
                                }
                            }, 
                            interests: {
                                MouseDown: {
                                    query: {
                                        position: "transform/localPosition"
                                    },
                                    handler: function(obj, results) {
                                        //console.log("MouseDown on Veg", obj.x, obj.y, results.position, obj.prefabName);
                                    }
                                }
                            }

                        });

                    prefabs.push(vegPrefab);

                }

                row.push(prefabs);

            })(x, y, tileY);

        }

    }

}


function CreateBlobs()
{
    var world = globals.world;
    var id = 0;
    var blobs = world.blobs;
    var blobData = blobs.blobData;
    var bloopData = blobs.bloopData;
    var bleepData = blobs.bleepData;
    var tinyScale = { x: 0.01, y: 0.01, z: 0.01 };
    var label;
    var t;

    var interests = {
        MouseEnter: {
            update: {
                'component:Rigidbody/maxAngularVelocity': 100,
                'component:Rigidbody/drag': 2,
                'component:Rigidbody/angularVelocity': { x: 0, y: 20, z: 0 },
                'transform:Ball/transform:A/component:MeshRenderer/material/color': { r: 1, g: 0, b: 0 },
                'transform:Ball/transform:B/component:MeshRenderer/material/color': { r: 0, g: 1, b: 1 }
            },
            events: [
                {
                    event: 'Animate',
                    data: [
                        {
                            command: 'scale',
                            target: 'transform:Ball',
                            time: 0.2,
                            to: { x: 2, y: 2, z: 2 }
                        }
                    ]
                }
            ],
            doNotSend: true
        },
        MouseExit: {
            update: {
                'component:Rigidbody/velocity': { x: 0, y: 150, z: 0 },
                'component:Rigidbody/drag': .1,
                'transform:Ball/transform:A/component:MeshRenderer/material/color': { r: 0, g: 0, b: 1 },
                'transform:Ball/transform:B/component:MeshRenderer/material/color': { r: 0, g: 1, b: 0 }
            },
            events: [
                {
                    event: 'Animate',
                    data: [
                        {
                            command: 'scale',
                            target: 'transform:Ball',
                            time: 2,
                            to: { x: 1, y: 1, z: 1 }
                        }
                    ]
                }
            ],
            doNotSend: true
        }
    };

    var blob = CreatePrefab({
        prefab: 'Prefabs/Bubble',
        component: 'Tracker',
        obj: {
            bloops: []
        },
        update: {
            "dragTracking": true,
            "transform/localPosition": blobData.position,
            "transform/localScale": tinyScale,
            "transform:Ball/transform:A/component:MeshRenderer/materials": [blobData.material],
            "transform:Ball/transform:A/component:Collider/sharedMaterial": blobData.physicMaterial,
            "transform:Ball/transform:A/component:Collider/radius": blobData.colliderRadius,
            "transform:Ball/transform:A/transform/localPosition": {y: -blobData.ballSpread + blobData.ballOffset},
            "transform:Ball/transform:A/transform/localScale": {x: blobData.ballAScale, y: blobData.ballAScale, z: blobData.ballAScale},
            "transform:Ball/transform:B/component:MeshRenderer/materials": [blobData.material],
            "transform:Ball/transform:B/component:Collider/sharedMaterial": blobData.physicMaterial,
            "transform:Ball/transform:B/component:Collider/radius": blobData.colliderRadius,
            "transform:Ball/transform:B/transform/localPosition": {y: blobData.ballSpread + blobData.ballOffset},
            "transform:Ball/transform:B/transform/localScale": {x: blobData.ballBScale, y: blobData.ballBScale, z: blobData.ballBScale},
            "component:Rigidbody/isKinematic": blobData.isKinematic,
            "component:Rigidbody/useGravity": blobData.useGravity,
            "component:Rigidbody/mass": blobData.mass,
            "component:Rigidbody/drag": blobData.drag,
            "component:Rigidbody/angularDrag": blobData.angularDrag
        },
        postEvents: [
            {
                event: 'Animate',
                data: [
                    {
                        command: 'scale',
                        to: blobData.size,
                        time: blobData.animateTime
                    }
                ]
            }
        ],
        interests: interests
    });

    globals.blob = blob;

    label = null; t = null;

    if (blobData.createProText) {
        label = CreatePrefab({
            prefab: "Prefabs/ProText",
            update: {
                'textMesh/text': 'Blob',
                'textMesh/fontSize': blobData.proTextFontSize,
                'component:RectTransform/sizeDelta': {x: 100, y: 50},
                trackPosition: 'Transform',
                'transformPosition!': 'object:' + blob.id + '/transform',
                extraOffset: { y: blobData.size * 1.2 },
                trackRotation: 'CameraRotation'
            }
        });
    }

    if (blobData.createOverlayText) {
        t = CreateOverlayText({
            "trackPosition": "Transform",
            "transformPosition!": "object:" + blob.id + "/transform",
            "textMesh/text": "blob " + id++,
            "textMesh/fontSize": blobData.overlayTextFontSize,
            "textMesh/color": { r: 1, g: 0.5, b: 0.5 },
            "component:RectTransform/sizeDelta": { x: 100, y: 50 }
        });
    }

    var lastBloopParent = blob;

    for (var bloopIndex = 0; bloopIndex < bloopData.count; bloopIndex++) {

        var ang = bloopIndex * (2.0 * Math.PI / bloopData.count);
        var deptX = blobData.position.x + Math.cos(ang) * bloopData.distance;
        var deptY = blobData.position.y;
        var deptZ = blobData.position.z + Math.sin(ang) * bloopData.distance;
        var bloop = CreatePrefab({
            prefab: 'Prefabs/Bubble', 
            component: 'Tracker',
            obj: {
                //blob: blob,
                index: bloopIndex,
                bleeps: []
            },
            update: {
                "dragTracking": true,
                "transform/localPosition": {x: deptX, y: deptY, z: deptZ},
                "transform/localScale": tinyScale,
                "transform:Ball/transform:A/component:MeshRenderer/materials": [bloopData.material],
                "transform:Ball/transform:A/component:Collider/sharedMaterial": bloopData.physicMaterial,
                "transform:Ball/transform:A/component:Collider/radius": bloopData.colliderRadius,
                "transform:Ball/transform:A/transform/localPosition": {y: -bloopData.ballSpread + bloopData.ballOffset},
                "transform:Ball/transform:A/transform/localScale": {x: bloopData.ballAScale, y: bloopData.ballAScale, z: bloopData.ballAScale},
                "transform:Ball/transform:B/component:MeshRenderer/materials": [bloopData.material],
                "transform:Ball/transform:B/component:Collider/sharedMaterial": bloopData.physicMaterial,
                "transform:Ball/transform:B/component:Collider/radius": bloopData.colliderRadius,
                "transform:Ball/transform:B/transform/localPosition": {y: bloopData.ballSpread + bloopData.ballOffset},
                "transform:Ball/transform:B/transform/localScale": {x: bloopData.ballBScale, y: bloopData.ballBScale, z: bloopData.ballBScale},
                "component:Rigidbody/isKinematic": bloopData.isKinematic,
                "component:Rigidbody/useGravity": bloopData.useGravity,
                "component:Rigidbody/mass": bloopData.mass,
                "component:Rigidbody/drag": bloopData.drag,
                "component:Rigidbody/angularDrag": bloopData.angularDrag,
                "component:SpringJoint/spring": bloopData.spring,
                "component:SpringJoint/autoConfigureConnectedAnchor": false,
                "component:SpringJoint/enableCollision": true,
                "component:SpringJoint/connectedBody!": "object:" + lastBloopParent.id + "/component:Rigidbody"
            },
            postEvents: [
                {
                    event: 'Animate',
                    data: [
                        {
                            command: 'scale',
                            to: bloopData.size,
                            time: bloopData.animateTime
                        }
                    ]
                }
            ],
            interests: interests

        });

        blob.bloops.push(bloop);

        label = null; t = null;

        if (bloopData.createProText) {
            label = CreatePrefab({
                prefab: "Prefabs/ProText",
                update: {
                    'textMesh/text': 'Bloop',
                    'textMesh/fontSize': bloopData.proTextFontSize,
                    'component:RectTransform/sizeDelta': {x: 100, y: 50},
                    trackPosition: 'Transform',
                    'transformPosition!': 'object:' + bloop.id + '/transform',
                    extraOffset: { y: bloopData.size * 1.2 },
                    trackRotation: 'CameraRotation'
                }
            });
        }

        if (bloopData.createOverlayText) {
            t = CreateOverlayText({
                "trackPosition": "Transform",
                "transformPosition!": "object:" + bloop.id + "/transform",
                "textMesh/text": "bloop " + id++,
                "textMesh/fontSize": bloopData.overlayTextFontSize,
                "textMesh/color": { r: 0.5, g: 1, b: 0.5 },
                "component:RectTransform/sizeDelta": { x: 100, y: 50 }
            });
        }

        if (bloopData.createRainbow) {
            var r = CreateRainbow(bloopData.rainbowType, lastBloopParent, label || bloop);
        }

        if (bloopData.linear) {
            lastBloopParent = bloop;
        }

        var color = {
            r: Math.random(),
            g: Math.random(),
            b: Math.random(),
            a: 0.5
        };

        var lastBleepParent = bloop;

        for (var bleepIndex = 0; bleepIndex < bleepData.count; bleepIndex++) {

            var ang2 = bleepIndex * (2.0 * Math.PI / bleepData.count);
            var offX = deptX + Math.cos(ang2) * bleepData.distance;
            var offY = deptY;
            var offZ = deptZ + Math.sin(ang2) * bleepData.distance;
            var bleep = CreatePrefab({
                prefab: 'Prefabs/Bubble', 
                component: 'Tracker',
                obj: {
                    //bloop: bloop,
                    index: bleepIndex
                },
                update: {
                    "dragTracking": true,
                    "transform/localPosition": {x: offX, y: offY, z: offZ},
                    "transform/localScale": tinyScale,
                    "transform:Ball/transform:A/component:MeshRenderer/materials": [bleepData.material],
                    "transform:Ball/transform:A/component:MeshRenderer/material/color": color,
                    "transform:Ball/transform:A/component:Collider/sharedMaterial": bleepData.physicMaterial,
                    "transform:Ball/transform:A/component:Collider/radius": bleepData.colliderRadius,
                    "transform:Ball/transform:A/transform/localPosition": {y: -bleepData.ballSpread + bleepData.ballOffset},
                    "transform:Ball/transform:A/transform/localScale": {x: bleepData.ballAScale, y: bleepData.ballAScale, z: bleepData.ballAScale},
                    "transform:Ball/transform:B/component:MeshRenderer/materials": [bleepData.material],
                    "transform:Ball/transform:B/component:MeshRenderer/material/color": color,
                    "transform:Ball/transform:B/component:Collider/sharedMaterial": bleepData.physicMaterial,
                    "transform:Ball/transform:B/component:Collider/radius": bleepData.colliderRadius,
                    "transform:Ball/transform:B/transform/localPosition": {y: bleepData.ballSpread + bleepData.ballOffset},
                    "transform:Ball/transform:B/transform/localScale": {x: bleepData.ballBScale, y: bleepData.ballBScale, z: bleepData.ballBScale},
                    "component:Rigidbody/isKinematic": bleepData.isKinematic,
                    "component:Rigidbody/useGravity": bleepData.useGravity,
                    "component:Rigidbody/mass": bleepData.mass,
                    "component:Rigidbody/drag": bleepData.drag,
                    "component:Rigidbody/angularDrag": bleepData.angularDrag,
                    "component:SpringJoint/spring": bleepData.spring,
                    "component:SpringJoint/autoConfigureConnectedAnchor": false,
                    "component:SpringJoint/enableCollision": true,
                    "component:SpringJoint/connectedBody!": "object:" + lastBleepParent.id + "/component:Rigidbody"
                },
                postEvents: [
                    {
                        event: 'Animate',
                        data: [
                            {
                                command: 'scale',
                                to: bleepData.size,
                                time: bleepData.animateTime
                            }
                        ]
                    }
                ],
                interests: interests
            });

            bloop.bleeps.push(bleep);

            label = null; t = null;

            if (bleepData.createProText) {
                label = CreatePrefab({
                    prefab: "Prefabs/ProText",
                    update: {
                        'textMesh/text': 'Bleep',
                        'textMesh/fontSize': bleepData.proTextFontSize,
                        'component:RectTransform/sizeDelta': {x: 100, y: 50},
                        trackPosition: 'Transform',
                        'transformPosition!': 'object:' + bleep.id + '/transform',
                        extraOffset: { y: bleepData.size * 1.2 },
                        trackRotation: 'CameraRotation'
                    }
                });
            }

            if (bleepData.createOverlayText) {
                t = CreateOverlayText({
                    "trackPosition": "Transform",
                    "transformPosition!": "object:" + bleep.id + "/transform",
                    "textMesh/text": "bleep " + id++,
                    "textMesh/fontSize": bleepData.overlayTextFontSize,
                    "textMesh/color": { r: 0.5, g: 0.5, b: 1 },
                    "component:RectTransform/sizeDelta": { x: 100, y: 50 }
                });
            }

            if (bleepData.createRainbow) {
                var r = CreateRainbow(bleepData.rainbowType, lastBleepParent, label || bleep);
            }

            if (bleepData.linear) {
                lastBleepParent = bleep;
            }
        }


    }

}


function CreateJsonsters()
{
    var world = globals.world;
}


function CreatePlaces()
{
    var world = globals.world;
    var places = world.places;
    var connections = world.connections;
    var placeObjectsByName = world.placeObjectsByName = {};
    var placeObjectsByID = world.placeObjectsByID = {};
    world.draggingPlace = null;
    world.draggingPlaceKissed = {};

    for (var placeIndex = 0, placeCount = places.length; placeIndex < placeCount; placeIndex++) {

        var place = places[placeIndex];

        var anchorObject =  CreatePrefab({
            "prefab": "Prefabs/Anchor",
            "update": {
                "transform/localPosition": place.position,
                dragTracking: true,
                "component:Rigidbody/drag": 10,
                "component:Rigidbody/isKinematic": true
            },
            interests: {
                DragStart: {
                    handler: function(obj, results) {
                        world.draggingPlace = obj.placeObject;
                        world.draggingPlaceKissed = {};
                        //console.log("game.js: Place Anchor: DragStart", obj.id);
                    }
                },
                DragStop: {
                    handler: function(obj, results) {
                        world.draggingPlace = null;
                        //console.log("game.js: Place Anchor: DragStop", obj.id);
                        QueryObject(obj.placeObject, {
                                position: 'transform/position'
                            }, function(results) {
                                //console.log("Moving anchor " + obj.id + " to " + results.position.x + " " + results.position.y + " " + results.position.z);
                                UpdateObject(obj, {
                                    "transform/position": results.position
                                });
                            });
                    }
                }
            }
        });

        var placeSpring = 100;
        var placeDamper = 10;
        var placeDrag = 10;

        var placeObject = CreatePrefab({
            "prefab": "Prefabs/Place",
            "obj": {
                connections: []
            },
            "update": {
                "transform/localPosition": place.position,
                "transform/localScale": place.size,
                "component:Collider/sharedMaterial": "PhysicMaterials/HighFrictionLowBounce",
                "component:Rigidbody/isKinematic": false,
                "component:Rigidbody/drag": placeDrag,
                "component:Rigidbody/constraints": "FreezePositionY,FreezeRotationX,FreezeRotationY,FreezeRotationZ",
                "component:SpringJoint/spring": placeSpring,
                "component:SpringJoint/damper": placeDamper,
                "component:SpringJoint/autoConfigureConnectedAnchor": false,
                "component:SpringJoint/enableCollision": true,
                "component:SpringJoint/connectedBody!": "object:" + anchorObject.id + "/component:Rigidbody",
                "component:TrackerProxy/target!": "object:" + anchorObject.id,
                "tiles/index:0/textureScale": {
                    "x": place.size.x * place.topTextureZoom,
                    "y": place.size.z * place.topTextureZoom
                },
                "tiles/index:0/component:MeshRenderer/material": place.topMaterial,
                "tiles/index:1/textureScale": {
                    "x": place.size.x * place.bottomTextureZoom,
                    "y": place.size.z * place.bottomTextureZoom
                },
                "tiles/index:1/component:MeshRenderer/material": place.bottomMaterial,
                "tiles/index:2/textureScale": {
                    "x": place.size.x * place.sideTextureZoom,
                    "y": place.size.y * place.sideTextureZoom
                },
                "tiles/index:2/component:MeshRenderer/material": place.sideMaterial,
                "tiles/index:3/textureScale": {
                    "x": place.size.x * place.sideTextureZoom,
                    "y": place.size.y * place.sideTextureZoom
                },
                "tiles/index:3/component:MeshRenderer/material": place.sideMaterial,
                "tiles/index:4/textureScale": {
                    "x": place.size.z * place.sideTextureZoom,
                    "y": place.size.y * place.sideTextureZoom
                },
                "tiles/index:4/component:MeshRenderer/material": place.sideMaterial,
                "tiles/index:5/textureScale": {
                    "x": place.size.z * place.sideTextureZoom,
                    "y": place.size.y * place.sideTextureZoom
                },
                "tiles/index:5/component:MeshRenderer/material": place.sideMaterial
            },
            interests: {
                CollisionEnter: {
                    query: {
                        collisionGameObjectName: 'collision/gameObject/name',
                        collisionObjectID: 'collision/gameObject/component:BridgeObject?/id',
                        collisionImpulse: 'collision/impulse',
                        collisionRelativeVelocity: 'collision/relativeVelocity'
                    },
                    handler: function(obj, results) {
                        // Ignore if not another place.
                        //console.log("game.js: Place: CollisionEnter", obj.id, JSON.stringify(results));
                        var collisionPlace = world.placeObjectsByID[results.collisionObjectID];
                        if ((!collisionPlace) ||
                             (world.draggingPlace != obj)) {
                            return;
                        }
                        world.draggingPlaceKissed[results.collisionObjectID] = true;
                        //console.log("KISS", obj.id, results.collisionObjectID, JSON.stringify(world.draggingPlaceKissed), JSON.stringify(results));
                        var foundConnection = null;
                        for (var i = 0, n = obj.connections.length; i < n; i++) {
                            var connection = obj.connections[i];
                            if ((connection.placeFrom == collisionPlace) ||
                                (connection.placeTo == collisionPlace)) {
                                foundConnection = connection;
                                break;
                            }
                        }
                        if (foundConnection == null) {
                            var newConnection = CreateRainbow('connection', obj, collisionPlace);
                            newConnection.placeFrom = obj;
                            newConnection.placeTo = collisionPlace;
                            obj.connections.push(newConnection);
                            collisionPlace.connections.push(newConnection);
                            //console.log("Creating connection", newConnection, newConnection.placeFrom.id, newConnection.placeTo.id);
                        } else {
                            //console.log("Destroying connection", foundConnection, foundConnection.placeFrom, foundConnection.placeTo);
                            //console.log(foundConnection.placeFrom.id, foundConnection.placeTo.id);
                            i = foundConnection.placeTo.connections.indexOf(foundConnection);
                            if (i < 0) {
                                console.log("MISSING", foundConnection);
                            } else {
                                foundConnection.placeTo.connections.splice(i, 1);
                            }
                            i = foundConnection.placeFrom.connections.indexOf(foundConnection);
                            if (i < 0) {
                                console.log("MISSING", foundConnection);
                            } else {
                                foundConnection.placeFrom.connections.splice(i, 1);
                            }
                            DestroyObject(foundConnection);
                        }
                    }
                },
                CollisionExit: {
                    query: {
                        collisionGameObjectName: 'collision/gameObject/name',
                        collisionObjectID: 'collision/gameObject/component:BridgeObject?/id',
                        collisionImpulse: 'collision/impulse',
                        collisionRelativeVelocity: 'collision/relativeVelocity'
                    },
                    handler: function(obj, results) {
                        // Ignore if not another place.
                        //console.log("game.js: Place: CollisionExit", obj.id, JSON.stringify(results));
                        var collisionPlace = world.placeObjectsByID[results.collisionObjectID];
                        if ((!collisionPlace) ||
                            (world.draggingPlace != obj)) {
                            return;
                        }
                        delete world.draggingPlaceKissed[results.collisionObjectID];
                        //console.log("UNKISS", obj.id, results.collisionObjectID, JSON.stringify(world.draggingPlaceKissed), JSON.stringify(results));
                    }
                }
            }
        });

        anchorObject.placeObject = placeObject;
        placeObject.anchorObject = anchorObject;

        placeObject.place = place;
        placeObjectsByName[place.name] = placeObject;
        placeObjectsByID[placeObject.id] = placeObject;

    }

    for (var connectionIndex = 0, connectionCount = connections.length; connectionIndex < connectionCount; connectionIndex++) {
        var connection = connections[connectionIndex];
        var placeFrom = placeObjectsByName[connection.from];
        var placeTo = placeObjectsByName[connection.to];
        var connectionObject = CreateRainbow('connection', placeFrom, placeTo);

        connectionObject.placeFrom = placeFrom;
        connectionObject.placeTo = placeTo;
        placeFrom.connections.push(connectionObject);
        placeTo.connections.push(connectionObject);
    }

}


function CreateTests()
{
    var world = globals.world;

    function CreateText(label, position, animation) {
        return CreatePrefab({
              prefab: 'Prefabs/KineticText',
              update: {
                  dragTracking: true,
                  "transform/localPosition": position,
                  "component:RectTransform/sizeDelta": {x: 50, y: 10},
                  "component:Rigidbody/isKinematic": true,
                  "component:Rigidbody/centerOfMass": {y: -10},
                  colliderThickness: 10,
                  "textMesh/text": label,
                  "textMesh/fontSize": 50
              }
          });
    }

    var time = 10;
    var x = -100;
    var y = 0;
    var z = 0;
    var step = 30;

    var test1 = CreateText("move\nposition", {x: x, y: y, z: z});
    AnimateObject(test1, [
        {
            command: 'move',
            time: time,
            position: {x: x + 50, y: y + 100, z: z}
        }
    ]);
    x += step;

    var test2 = CreateText("move\ntransform", {x: x, y: y, z: z});
    AnimateObject(test2, [
        {
            command: 'move',
            time: time,
            transform: 'object:' + test1.id + '/transform'
        }
    ]);
    x += step;

    var test3 = CreateText("move\npath", {x: x, y: y, z: z});
    var wiggle = 20;
    var path = [
        {x: x,            y: y,       z: z},
         {x: x - wiggle,  y: y + 10,  z: z},
         {x: x - wiggle,  y: y + 20,  z: z},
        {x: x,            y: y + 30,  z: z},
        {x: x,            y: y + 30,  z: z},
         {x: x + wiggle,  y: y + 40,  z: z},
         {x: x + wiggle,  y: y + 50,  z: z},
        {x: x,            y: y + 60,  z: z}
    ];
    AnimateObject(test3, [
        {
            command: 'moveLocal',
            time: time,
            path: path
        }
    ]);
    x += step; 

    var test4 = CreateText("scale\nto", {x: x, y: y, z: z});
    AnimateObject(test4, [
        {
            command: 'scale',
            time: time,
            to: { x: 0.5, y: 2, z: 0.1 }
        }
    ]);
    x += step;

    var test5 = CreateText("rotate\nto", {x: x, y: y, z: z});
    AnimateObject(test5, [
        {
            command: 'rotate',
            time: time,
            to: { x: 0, y: 180, z: 0 }
        }
    ]);
    x += step;

    var test6 = CreateText("rotate\naround", {x: x, y: y, z: z});
    AnimateObject(test6, [
        {
            command: 'rotateAround',
            time: time,
            axis: { x: 1, y: 1, z: 0 },
            to: 360 * 10
        }
    ]);
    x += step;

}


function CreatePrivate()
{
}


function CreateRainbow(kind, fromTarget, toTarget, parent)
{
    var world = globals.world;
    var rainbows = world.rainbows;
    var rainbow = rainbows[kind];

    //console.log("bows", JSON.stringify(world.bows));

    var rainbowObject =
        CreatePrefab({
            prefab: 'Prefabs/Rainbow',
            obj: {
                bows: []
            },
            parent: parent ? ('object:' + parent.id) : null,
            update: {
                'fromTransform!': 'object:' + fromTarget.id + '/transform',
                'toTransform!': 'object:' + toTarget.id + '/transform',
                bowHeight: rainbow.bowHeight,
                fromWidth: rainbow.rainbowWidth,
                toWidth: rainbow.rainbowWidth
            }
        });

    world.rainbow = rainbow;

    var bows = rainbow.bows;
    for (var bowIndex = 0;
         bowIndex < bows.length;
         bowIndex++) {

        var bowUpdate = bows[bowIndex];

        //console.log("bowConfig", JSON.stringify(bowConfig));

        var bowObject =
            CreatePrefab({
                prefab: 'Prefabs/Bow',
                parent: 'object:' + rainbowObject.id,
                update: bowUpdate
            });

        rainbowObject.bows.push(bowObject);
    }

    return rainbowObject;
}


////////////////////////////////////////////////////////////////////////
