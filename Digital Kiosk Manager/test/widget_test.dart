import 'package:flutter_test/flutter_test.dart';
import 'package:digital_kiosk_manager/src/app.dart';

void main() {
  testWidgets('shows saved servers section', (WidgetTester tester) async {
    await tester.pumpWidget(const DigitalKioskManagerApp());

    expect(find.text('Serveurs enregistrés'), findsOneWidget);
    expect(find.text('Tester la connexion'), findsOneWidget);
  });
}
