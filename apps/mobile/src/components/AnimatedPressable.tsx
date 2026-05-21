import { forwardRef, useRef } from "react";
import {
  Animated,
  TouchableOpacity,
  type GestureResponderEvent,
  type TouchableOpacityProps,
  type View
} from "react-native";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const AnimatedPressable = forwardRef<View, TouchableOpacityProps>(
  ({ activeOpacity = 0.78, disabled, onPressIn, onPressOut, style, ...props }, ref) => {
    const scale = useRef(new Animated.Value(1)).current;

    function animateScale(value: number) {
      if (disabled) {
        return;
      }

      Animated.spring(scale, {
        bounciness: 4,
        speed: 28,
        toValue: value,
        useNativeDriver: true
      }).start();
    }

    function handlePressIn(event: GestureResponderEvent) {
      animateScale(0.98);
      onPressIn?.(event);
    }

    function handlePressOut(event: GestureResponderEvent) {
      animateScale(1);
      onPressOut?.(event);
    }

    return (
      <AnimatedTouchable
        activeOpacity={activeOpacity}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        ref={ref}
        style={[style, !disabled ? { transform: [{ scale }] } : null]}
        {...props}
      />
    );
  }
);

AnimatedPressable.displayName = "AnimatedPressable";
