import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'src/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Workaround: Flutter Windows accessibility_plugin.cc bug (issue #152928).
  // The engine sends an announce message where 'viewId' is a plain integer
  // instead of a FlutterViewId object. The native plugin logs an error and
  // may propagate an unhandled exception that kills the Dart isolate.
  // Intercept at both the FlutterError and PlatformDispatcher levels so the
  // app continues running; all other errors are forwarded normally.
  if (defaultTargetPlatform == TargetPlatform.windows) {
    final originalOnError = FlutterError.onError;
    FlutterError.onError = (FlutterErrorDetails details) {
      final msg = details.exception.toString();
      if (msg.contains('FlutterViewId') || msg.contains('viewId')) {
        return; // swallow known accessibility bug
      }
      originalOnError?.call(details);
    };

    ui.PlatformDispatcher.instance.onError = (error, stack) {
      final msg = error.toString();
      if (msg.contains('FlutterViewId') || msg.contains('viewId')) {
        return true; // swallow
      }
      debugPrint('[PlatformDispatcher] $error\n$stack');
      return false;
    };
  }

  ui.DartPluginRegistrant.ensureInitialized();
  runApp(const DigitalKioskManagerApp());
}
