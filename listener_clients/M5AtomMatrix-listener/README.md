# TallyArbiter-M5AtomMatrixListener
This is a Tally Viewer using a M5 Atom Matrix as a TallyArbiter Client.
This is my attempt at 'mushing' arduino code.
* Buy them here:
https://m5stack.com/collections/m5-atom/products/atom-matrix-esp32-development-kit

# Video Demo

https://youtu.be/Mc_PCxg6qdc

# Current Updates:
* Tidyed up things a little bit
* Changed the way the LED's are written to now using the M5 library
* Added Blank and 1 thru 16 camera numbers by pushing the screen (M5 Action button)
* Fixed bugs

Note if deploying yourself, one of the librarys has an error where you have to manually comment out hexdump by changing it to //hexdump

# Planned Updates:
Next Update will have Internal Motion Unit functionality to automatically rotate the screen.

# Thanks
Thanks to mg-1999 for the code base, and huge thanks to josephdadams for his amazing work on TallyArbiter, and the origional M5StickC implementation.
https://github.com/josephdadams/TallyArbiter
