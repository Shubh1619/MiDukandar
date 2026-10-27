import 'package:app/widgets/app_dialogs.dart';
import 'package:app/widgets/md_inputs.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Regression test for the "A TextEditingController was used after being
/// disposed" crash. Screens create their controllers before opening a form
/// sheet and dispose them as soon as the sheet's future completes. The future
/// must therefore resolve only after the sheet has finished its exit animation
/// and been unmounted.
void main() {
  testWidgets('showFormSheet completes after the sheet is unmounted',
      (tester) async {
    final controller = TextEditingController(text: '10');
    var disposed = false;
    addTearDown(() {
      if (!disposed) controller.dispose();
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: ElevatedButton(
                onPressed: () async {
                  await AppDialogs.showFormSheet<void>(
                    context,
                    title: 'Edit amount',
                    builder: (_) =>
                        NumberField(controller: controller, label: 'Amount'),
                  );
                  controller.dispose();
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
    expect(find.text('Edit amount'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();

    expect(disposed, isTrue);
    expect(find.text('Edit amount'), findsNothing);
  });
}
