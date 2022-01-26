# Embedded listener client

# Development

## Configuring platformio.ini

Used build flags here:
|                   FLAG NAME                  |                         DESCRIPTION                        | EXAMPLE VALUE |
|:--------------------------------------------:|:----------------------------------------------------------:|:-------------:|
| PLATFORM_ARCH_ESP32<br>PLATFORM_ARCH_ESP8266 | Determine if the processor is ESP32-based or ESP8266-based |               |
| PLATFORM_NAME                                | Listener client name added in TallyArbiter                 |               |
|                                              |                                                            |               |

We use the following flags to enable platform-specific features (like displays and custom hardware peripherals):
|     FLAG NAME     |        DESCRIPTION       | EXAMPLE VALUE |
|:-----------------:|:------------------------:|:-------------:|
| PLATFORM_M5ATOM   | Enable M5Atom features   |               |
| PLATFORM_M5STACK  | Enable M5Stack features  |               |
| PLATFORM_M5STICKC | Enable M5StickC features |               |
| PLATFORM_TTGO     | Enable TTGO features     |               |

> If a device has no other internal peripherals (like esp32dev, esp12e, esp1_1m, esp07), you can add it without other "PLATFORM_ABCDEF" flag
Doing this, it's required to edit your personal user_config_override.h file to enable platform-agnostic features, like tally status output or NeoPixel.



