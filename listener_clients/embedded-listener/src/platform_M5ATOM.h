#ifdef PLATFORM_M5ATOM

extern String selectedDeviceId;
extern char ta_host[60];
extern char ta_port[8];

#include <M5Atom.h>

#define GRB_COLOR_WHITE 0xffffff
#define GRB_COLOR_BLACK 0x000000
#define GRB_COLOR_RED 0xff0000
#define GRB_COLOR_ORANGE 0xa5ff00
#define GRB_COLOR_YELLOW 0xffff00
#define GRB_COLOR_GREEN 0x00ff00
#define GRB_COLOR_BLUE 0x0000ff
#define GRB_COLOR_PURPLE 0x008080

int numbercolor = GRB_COLOR_WHITE;

int flashcolor[] = {GRB_COLOR_WHITE, GRB_COLOR_WHITE};
int offcolor[] = {GRB_COLOR_BLACK, numbercolor};
int badcolor[] = {GRB_COLOR_BLACK, GRB_COLOR_RED};
int readycolor[] = {GRB_COLOR_BLACK, GRB_COLOR_GREEN};
int alloffcolor[] = {GRB_COLOR_BLACK, GRB_COLOR_BLACK};
int wificolor[] = {GRB_COLOR_BLACK, GRB_COLOR_BLUE};
int infocolor[] = {GRB_COLOR_BLACK, GRB_COLOR_ORANGE};

//this is the array that stores the number layout
int number_layout[17][25] = {{
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 1,
    1, 1, 1, 1, 1,
    0, 1, 0, 0, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 0, 1,
    1, 0, 1, 0, 1,
    1, 0, 1, 1, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 0, 1, 0, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    0, 0, 1, 0, 0,
    1, 1, 1, 0, 0,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 0, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 0, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 0, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 0, 0, 0,
    1, 0, 1, 0, 0,
    1, 0, 0, 1, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 0, 1,
    0, 0, 0, 0, 0
  },
  { 1, 1, 1, 1, 1,
    1, 0, 0, 0, 1,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0
  },
  { 1, 1, 1, 0, 1,
    1, 0, 1, 0, 1,
    1, 0, 1, 1, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 0, 1, 0, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 1, 1, 1, 1, 1,
    0, 0, 1, 0, 0,
    1, 1, 1, 0, 0,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 1, 0, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 0, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 1, 0, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
};

// this array stores all the icons for the display
int icons[13][25] = {
  { 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1
  }, // full blank
  { 0, 0, 1, 1, 1,
    0, 1, 0, 0, 0,
    1, 0, 0, 1, 1,
    1, 0, 1, 0, 0,
    1, 0, 1, 0, 1
  }, // wifi 3 rings
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 1, 1,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 1
  }, // wifi 2 rings
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 1
  }, // wifi 1 ring
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0
  }, // reassign 1
  { 0, 0, 0, 0, 0,
    0, 1, 1, 1, 0,
    0, 1, 0, 1, 0,
    0, 1, 1, 1, 0,
    0, 0, 0, 0, 0
  }, // reassign 2
  { 1, 1, 1, 1, 1,
    1, 0, 0, 0, 1,
    1, 0, 0, 0, 1,
    1, 0, 0, 0, 1,
    1, 1, 1, 1, 1
  }, // reassign 3
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0
  }, // setup 1
  { 0, 0, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 1, 0, 1, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 0, 0
  }, // setup 2
  { 0, 0, 1, 0, 0,
    0, 0, 0, 0, 0,
    1, 0, 0, 0, 1,
    0, 0, 0, 0, 0,
    0, 0, 1, 0, 0
  }, // setup 3
  { 1, 0, 0, 0, 1,
    0, 1, 0, 1, 0,
    0, 0, 1, 0, 0,
    0, 1, 0, 1, 0,
    1, 0, 0, 0, 1
  }, // error
  { 0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
    0, 0, 0, 0, 1,
    0, 0, 0, 1, 0
  }, // good
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0
  }, // no icon
};

void m5atomDrawNumber(int arr[], int colors[]) {
    for (int i = 0; i < 25; i++) {
        M5.dis.drawpix(i, colors[arr[i]]);
    }
}

void m5atomInitialize() {
    M5.begin(true, false, true);
    delay(50);
    M5.dis.drawpix(0, 0xf00000);

    // blanks out the screen
    m5atomDrawNumber(icons[0], alloffcolor);
    delay(100); //wait 100ms before moving on

    //do startup animation
    m5atomDrawNumber(icons[7], infocolor);
    delay(400);
    m5atomDrawNumber(icons[8], infocolor);
    delay(400);
    m5atomDrawNumber(icons[9], infocolor);
    delay(400);
}

void m5atomDisplayFailMark() {
    m5atomDrawNumber(icons[10], badcolor);
}

void m5atomDisplayWiFiConnected() {
    // Flash screen if connected to wifi.
    m5atomDrawNumber(icons[3], wificolor); //1 ring
    delay(500);
    m5atomDrawNumber(icons[2], wificolor); //2 rings
    delay(500);
    m5atomDrawNumber(icons[1], wificolor); //3 rings
    delay(500);
    m5atomDrawNumber(icons[11], readycolor); //display okay mark
    delay(400);
}

void m5atomFillScreen(int r, int g, int b) {
    int backgroundColor = 0x10000 * r + 0x100 * g + b;
    int screen_color[2] = {backgroundColor, backgroundColor};
    m5atomDrawNumber(icons[1], screen_color);
}

void m5atomReassign() {
    m5atomDrawNumber(icons[1], alloffcolor);
    delay(200);
    m5atomDrawNumber(icons[4], readycolor);
    delay(300);
    m5atomDrawNumber(icons[1], alloffcolor);
    delay(200);
    m5atomDrawNumber(icons[5], readycolor);
    delay(300);
    m5atomDrawNumber(icons[1], alloffcolor);
    delay(200);
    m5atomDrawNumber(icons[6], readycolor);
    delay(300);
    m5atomDrawNumber(icons[1], alloffcolor);
    delay(200);
}

void m5atomEvaluateTally(String type, int r, int g, int b) {
    if (type != "") {
        int backgroundColor = 0x10000 * r + 0x100 * g + b;
        int currColor[] = {backgroundColor, numbercolor};
        //m5atomDrawNumber(number_layout[camNumber], currColor);
        m5atomDrawNumber(icons[12], currColor);
    } else {
        //m5atomDrawNumber(number_layout[camNumber], offcolor);
        m5atomDrawNumber(number_layout[12], offcolor);
    }
}

#endif
