import 'package:flutter/material.dart';

import '../theme/md_design.dart';

/// Shapes used by the shared loading placeholder.
enum SkeletonKind { list, grid, table, detail }

/// A lightweight shimmer placeholder shown while a screen fetches its first
/// page of data. Later background refreshes keep the real content on screen.
class SkeletonLoader extends StatefulWidget {
  const SkeletonLoader({
    super.key,
    this.kind = SkeletonKind.list,
    this.itemCount = 6,
    this.padding = const EdgeInsets.all(16),
  });

  final SkeletonKind kind;
  final int itemCount;
  final EdgeInsetsGeometry padding;

  @override
  State<SkeletonLoader> createState() => _SkeletonLoaderState();
}

class _SkeletonLoaderState extends State<SkeletonLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Alignment> _shimmer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
    _shimmer = Tween<Alignment>(
      begin: const Alignment(-1.5, 0),
      end: const Alignment(1.5, 0),
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _block(double width, double height, {double radius = 8}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }

  Widget _painted(Widget child) {
    return ShaderMask(
      shaderCallback: (bounds) => LinearGradient(
        begin: _shimmer.value,
        end: _shimmer.value + const Alignment(0.6, 0),
        colors: const [
          MdColors.navy100,
          MdColors.surface,
          MdColors.navy100,
        ],
        stops: const [0.0, 0.5, 1.0],
      ).createShader(bounds),
      blendMode: BlendMode.srcATop,
      child: child,
    );
  }

  Widget _header() {
    return Row(
      children: [
        _block(140, 22, radius: 6),
        const Spacer(),
        _block(96, 36, radius: 10),
      ],
    );
  }

  Widget _listRow() {
    return _painted(
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: MdColors.border),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            _block(40, 40, radius: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _block(150, 14, radius: 5),
                  const SizedBox(height: 8),
                  _block(110, 11, radius: 5),
                ],
              ),
            ),
            const SizedBox(width: 12),
            _block(64, 12, radius: 5),
          ],
        ),
      ),
    );
  }

  Widget _gridCard() {
    return _painted(
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: MdColors.border),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(child: _block(90, 11, radius: 4)),
                _block(26, 26, radius: 8),
              ],
            ),
            const SizedBox(height: 12),
            _block(110, 24, radius: 6),
            const SizedBox(height: 8),
            _block(130, 10, radius: 4),
          ],
        ),
      ),
    );
  }

  Widget _tableRow() {
    return _painted(
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: MdColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(flex: 3, child: _block(140, 13, radius: 5)),
            Expanded(flex: 2, child: _block(80, 13, radius: 5)),
            Expanded(flex: 2, child: _block(70, 13, radius: 5)),
            _block(54, 13, radius: 5),
          ],
        ),
      ),
    );
  }

  Widget _detailRow() {
    return _painted(
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _block(100, 11, radius: 4),
            const SizedBox(height: 8),
            Container(
              height: 46,
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: MdColors.border),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _content() {
    switch (widget.kind) {
      case SkeletonKind.grid:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _header(),
            const SizedBox(height: 18),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.45,
              ),
              itemCount: widget.itemCount < 2 ? 2 : widget.itemCount,
              itemBuilder: (_, _) => _gridCard(),
            ),
          ],
        );
      case SkeletonKind.table:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _header(),
            const SizedBox(height: 18),
            for (var i = 0; i < widget.itemCount; i++) _tableRow(),
          ],
        );
      case SkeletonKind.detail:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _header(),
            const SizedBox(height: 18),
            for (var i = 0; i < widget.itemCount; i++) _detailRow(),
          ],
        );
      case SkeletonKind.list:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _header(),
            const SizedBox(height: 18),
            for (var i = 0; i < widget.itemCount; i++) _listRow(),
          ],
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _shimmer,
      builder: (context, _) => Padding(
        padding: widget.padding,
        child: SingleChildScrollView(
          physics: const NeverScrollableScrollPhysics(),
          child: _content(),
        ),
      ),
    );
  }
}
