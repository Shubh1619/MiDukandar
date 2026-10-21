import 'package:flutter_test/flutter_test.dart';
import 'package:app/widgets/md_inputs.dart';

/// Regression test for the "01" number-entry bug: typing 0 then 1 used to leave
/// "01" in the controller (and could be sent to the API). normalizeNumberText
/// (used by NumberField / NumberTextInputFormatter) strips leading zeros.
void main() {
  String norm(String input, {bool allowNegative = false, int decimals = 2}) =>
      normalizeNumberText(input, allowNegative: allowNegative, decimals: decimals);

  test('strips a leading zero ("01" -> "1")', () {
    expect(norm('01'), '1');
  });

  test('strips multiple leading zeros', () {
    expect(norm('00012'), '12');
  });

  test('keeps a lone zero', () {
    expect(norm('0'), '0');
  });

  test('keeps zero before a decimal', () {
    expect(norm('0.5'), '0.5');
    expect(norm('00.5'), '0.5');
  });

  test('limits decimals and separators', () {
    expect(norm('1.239'), '1.23');
    expect(norm('1.2.3'), '1.23');
    expect(norm('.'), '0.');
    expect(norm('1.'), '1.');
  });

  test('drops non-numeric characters and stays empty', () {
    expect(norm('1a2'), '12');
    expect(norm(''), '');
  });

  test('handles the minus sign', () {
    expect(norm('-5'), '5');
    expect(norm('-5', allowNegative: true), '-5');
    expect(norm('-05', allowNegative: true), '-5');
  });

  test('integer-only mode drops the decimal part', () {
    expect(norm('1.9', decimals: 0), '1');
  });
}
