# UnityJS

UnityJS is a plugin for Unity 5 that integrates JavaScript and
web browser components into Unity.
It works on Android, iOS, macOS and Windows.

unity-js is derived from gree's unity-webview
https://github.com/gree/unity-webview

unity-webview is derived from keijiro-san's
https://github.com/keijiro/unity-webview-integration .

## Sample Project

It is placed under `sample/`. You can open it and import the plugin as
below:

1. Open `sample/Assets/Sample.unity`.
2. Open `dist/UnityJS.unitypackage` and import all files. It
   might be easier to extract `dist/UnityJS.zip` instead if
   you've imported UnityJS before.

## Platform Specific Notes

### macOS (Editor)

Since Unity 5.3.0, Unity.app is built with ATS (App Transport
Security) enabled and non-secured connection (HTTP) is not
permitted. If you want to open `http://foo/bar.html` with this plugin
on Unity OS X Editor, you need to open
`/Applications/Unity5.3.4p3/Unity.app/Contents/Info.plist` with a text
editor and add the following,

```diff
--- Info.plist~	2016-04-11 18:29:25.000000000 +0900
+++ Info.plist	2016-04-15 16:17:28.000000000 +0900
@@ -57,5 +57,10 @@
 	<string>EditorApplicationPrincipalClass</string>
 	<key>UnityBuildNumber</key>
 	<string>b902ad490cea</string>
+	<key>NSAppTransportSecurity</key>
+	<dict>
+		<key>NSAllowsArbitraryLoads</key>
+		<true/>
+	</dict>
 </dict>
 </plist>
```

or invoke the following from your terminal,

```bash
/usr/libexec/PlistBuddy -c "Add NSAppTransportSecurity:NSAllowsArbitraryLoads bool true" /Applications/Unity/Unity.app/Contents/Info.plist
```

#### References

### iOS

### Android

### macOS

### Windows

### Building

The "build" directory contains a rake script to build the code,
and a Unity project to create "dist/UnityJS.unitypackage"
and "dist/UnityJS.zip".

```cd build
rake
rake pack
```

The sample project has symbolic links into the source code and built
libraries, so you can use it to develop and debug the library without
reinstalling the unity package after every change. Do not attempt to
install the UnityJS.unitypackage into the sample project, since that
will stomp on those links and might write over the source code.
