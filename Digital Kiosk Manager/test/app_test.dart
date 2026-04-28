import 'package:flutter_test/flutter_test.dart';
import 'package:digital_kiosk_manager/src/app.dart';

void main() {
  testWidgets('renders server entry page by default', (tester) async {
    await tester.pumpWidget(const DigitalKioskManagerApp());

    expect(find.text('Connexion serveur'), findsOneWidget);
    expect(find.text('Connexion sécurisée'), findsOneWidget);
  });
}
