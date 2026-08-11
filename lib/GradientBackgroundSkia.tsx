import {
  Canvas,
  Group,
  Path,
  Skia,
  TileMode,
  vec,
} from "@shopify/react-native-skia";
import React, { useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

interface GradientBackgroundSkiaProps {
  style?: StyleProp<ViewStyle>;
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  borderRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  testID?: string;
  children?: React.ReactNode;
}

/**
 * Reads a numeric width/height out of the style so a fixed-size gradient paints
 * on its first frame rather than waiting for onLayout.
 */
const measureFromStyle = (style?: StyleProp<ViewStyle>) => {
  const flat = StyleSheet.flatten(style) || {};
  return {
    width: typeof flat.width === "number" ? flat.width : 0,
    height: typeof flat.height === "number" ? flat.height : 0,
  };
};

const GradientBackgroundSkia: React.FC<GradientBackgroundSkiaProps> = ({
  style,
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  borderRadius = 0,
  borderBottomLeftRadius,
  borderBottomRightRadius,
  borderTopLeftRadius,
  borderTopRightRadius,
  children,
  testID,
  ...rest
}) => {
  const [size, setSize] = useState(() => measureFromStyle(style));
  const { width, height } = size;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === w && current.height === h
        ? current
        : { width: w, height: h },
    );
  };

  // Calculate individual corner radii
  const topLeft =
    borderTopLeftRadius !== undefined ? borderTopLeftRadius : borderRadius;
  const topRight =
    borderTopRightRadius !== undefined ? borderTopRightRadius : borderRadius;
  const bottomRight =
    borderBottomRightRadius !== undefined
      ? borderBottomRightRadius
      : borderRadius;
  const bottomLeft =
    borderBottomLeftRadius !== undefined
      ? borderBottomLeftRadius
      : borderRadius;

  const path = useMemo(() => {
    if (width === 0 || height === 0) return null;

    // Radii larger than half the box make the manual path self-intersect, so
    // cap them the way the CSS/Yoga border-radius does.
    const limit = Math.min(width, height) / 2;
    const tl = Math.max(0, Math.min(topLeft, limit));
    const tr = Math.max(0, Math.min(topRight, limit));
    const br = Math.max(0, Math.min(bottomRight, limit));
    const bl = Math.max(0, Math.min(bottomLeft, limit));

    const path = Skia.Path.Make();

    // Drawn by hand because addRRect does not take per-corner radii. Each corner
    // is a quarter ellipse so it matches a View's border radius. A zero radius
    // has no oval to sweep, so the preceding lineTo already squares it off.
    const corner = (r: number, x: number, y: number, startAngle: number) => {
      if (r > 0) {
        path.arcToOval(
          { x, y, width: r * 2, height: r * 2 },
          startAngle,
          90,
          false,
        );
      }
    };

    path.moveTo(tl, 0);
    path.lineTo(width - tr, 0);
    corner(tr, width - tr * 2, 0, -90);
    path.lineTo(width, height - br);
    corner(br, width - br * 2, height - br * 2, 0);
    path.lineTo(bl, height);
    corner(bl, 0, height - bl * 2, 90);
    path.lineTo(0, tl);
    corner(tl, 0, 0, 180);
    path.close();

    return path;
  }, [width, height, topLeft, topRight, bottomRight, bottomLeft]);

  // Depends on the values rather than the objects: callers pass literals for
  // colors/start/end, which change identity on every render.
  const colorKey = colors.join("|");
  const paint = useMemo(() => {
    if (width === 0 || height === 0) return null;

    // Convert string colors to Skia colors
    const skiaColors = colors.map((color) => Skia.Color(color));

    const startPoint = vec(start.x * width, start.y * height);
    const endPoint = vec(end.x * width, end.y * height);

    const p = Skia.Paint();
    const shader = Skia.Shader.MakeLinearGradient(
      startPoint,
      endPoint,
      skiaColors,
      null,
      TileMode.Clamp,
    );
    p.setShader(shader);
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, colorKey, start.x, start.y, end.x, end.y]);

  return (
    <View style={style} onLayout={onLayout} testID={testID} {...rest}>
      {width > 0 && height > 0 && path && paint && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group>
            <Path path={path} paint={paint} />
          </Group>
        </Canvas>
      )}

      {children}
    </View>
  );
};

export default GradientBackgroundSkia;
