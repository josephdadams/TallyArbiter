#ifndef _USER_CONFIG_H_
#define _USER_CONFIG_H_

/*
Please, do *not* update your config values here.
Use the file "user_config_override.h" instead, and if you haven't got one, copy and rename the file "user_config_override_sample.h".
To update a configuration value, follow the instructions in the "user_config_override.h" file.
*/

#define USE_STATIC_IP false

#define RESET_DURING_BOOT_IF_BUTTON_PRESSED true

#ifdef PLATFORM_M5STICKC
#define M5STICKC_BRIGHTNESS 11
#endif

#ifdef PLATFORM_TTGO
#define TTGO_SCREEN_ROTATION 1
#define TTGO_SWAP_BYTES true
#define TTGO_ADC_EN  14 //ADC detection enable port
#define TTGO_ADC_PIN 34
#define TTGO_TFT_DISPOFF 0x28
#define TTGO_TFT_SLPIN   0x10
#define TTGO_ENABLE_BATTERY_INDICATOR true
#define TTGO_BATTERY_VREF 1100
#define TTGO_BATTERY_MAX_VOLTAGE 4.07 //100% = 3.7V
#define TTGO_BATTERY_MIN_VOLTAGE 3.0  //Vmin = 2.8V
#define TTGO_BATTERY_INDICATOR_COLOR 0xFFFF
#define TTGO_BATTERY_LOW_INDICATOR_COLOR 0xFF00
#endif

#include "user_config_override.h"         // Configuration overrides for user_config.h

#endif