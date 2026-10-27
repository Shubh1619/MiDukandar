import 'package:app/l10n/generated/app_localizations.dart';
import 'package:app/widgets/app_dialogs.dart';
import 'package:app/widgets/md_inputs.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Regression test for the "A TextEditingController was used after being
/// disposed" crash.
///
/// Screens create their controllers before opening a form sheet and dispose
/// them as soon as the sheet's future completes. On device that future used to
/// resolve as soon as the pop *started*, so the controllers were disposed while
/// the sheet was still animating out. Flutter keeps rebuilding the sheet during
/// that animation (the keyboard inset animates too), which then rebuilt the
/// `TextField` with a disposed controller and ended in a
/// "Multiple widgets used the same GlobalKey" cascade.
void main() {
  testWidgets('form sheet controllers outlive the exit animation',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    final amount = TextEditingController(text: '10');
    final mobile = TextEditingController(text: '9876543210');
    final mobileKey = GlobalKey<MobileNumberFieldState>();
    var disposed = false;
    addTearDown(() {
      if (!disposed) {
        amount.dispose();
        mobile.dispose();
      }
    });

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: ElevatedButton(
                onPressed: () async {
                  await AppDialogs.showFormSheet<void>(
                    context,
                    title: 'Add udhaari',
                    builder: (_) => Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        NumberField(controller: amount, label: 'Amount'),
                        MobileNumberField(
                          key: mobileKey,
                          controller: mobile,
                        ),
                      ],
                    ),
                  );
                  // Callers dispose immediately after the future resolves.
                  amount.dispose();
                  mobile.dispose();
                  disposed = true;
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Add udhaari'), findsOneWidget);

    // Keyboard opens (insets grow) while the sheet is up.
    tester.view.viewInsets = const FakeViewPadding(bottom: 900);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    await tester.tap(find.byIcon(Icons.close));

    // The keyboard closes while the sheet runs its exit animation. This keeps
    // rebuilding the sheet content throughout the animation.
    tester.view.viewInsets = FakeViewPadding.zero;
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(disposed, isTrue);
    expect(find.text('Add udhaari'), findsNothing);
  });
}
