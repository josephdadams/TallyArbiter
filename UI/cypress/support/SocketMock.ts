class NotImplementedError extends Error {
  constructor(message = "") {
    super(message);
    this.message = message + " has not yet been implemented.";
  }
}

class SocketMock {
  realSocket: any;
  interceptedRequestSocketEvents: string[];
  interceptRequestCallbacks: any;
  interceptedResponseSocketEvents: string[];
  interceptResponseCallbacks: any;
  callbacks: any;

  constructor(realSocket: any) {
    this.realSocket = realSocket;
    this.interceptedRequestSocketEvents = [];
    this.interceptRequestCallbacks = {};
    this.interceptedResponseSocketEvents = [];
    this.interceptResponseCallbacks = {};
    this.callbacks = {};
    this.realSocket.onAny((event: string, ...args: any) => {
      if (!this.interceptedResponseSocketEvents.includes(event)) {
        this.callEventListeners(event, ...args);
      } else {
        console.log("Intercepted event '%s' from realSocket. args: %o", event, args);
        try{
          this.interceptResponseCallbacks[event].forEach((callback: (...args: any) => void) => {
            callback(...args);
          });
        } catch(e) {
          //this.interceptResponseCallbacks[event] was deleted by the callbacks
        }
      }
    });
  };

  interceptRequest(event: string, callback: (...args: any) => void) {
    if (!this.interceptedRequestSocketEvents.includes(event)) this.interceptedRequestSocketEvents.push(event);
    if (typeof this.interceptRequestCallbacks[event] === 'undefined') {
      this.interceptRequestCallbacks[event] = []
    }
    this.interceptRequestCallbacks[event].push(callback);
  }

  removeRequestInterceptors(event: string) {
    delete this.interceptRequestCallbacks[event];
    delete this.interceptedRequestSocketEvents[event];
  }

  interceptResponse(event: string, callback: (...args: any) => void) {
    if (!this.interceptedResponseSocketEvents.includes(event)) this.interceptedResponseSocketEvents.push(event);
    if (typeof this.interceptResponseCallbacks[event] === 'undefined') {
      this.interceptResponseCallbacks[event] = []
    }
    this.interceptResponseCallbacks[event].push(callback);
  }

  removeResponseInterceptors(event: string) {
    delete this.interceptResponseCallbacks[event];
    delete this.interceptedResponseSocketEvents[event];
  }

  callEventListeners(event: string, ...args: any) {
    if (typeof this.callbacks[event] !== 'undefined') {
      this.callbacks[event].forEach((callback: (...args: any) => void) => {
        callback(...args);
      });
    }
  }

  emitRealSocket(event: string, ...args: any) {
    this.realSocket.emit(event, ...args);
  }

  on(event: string, callback: (...args: any) => void) {
    if (typeof this.callbacks[event] === 'undefined') {
      this.callbacks[event] = []
    }
    this.callbacks[event].push(callback);
  }

  onAny(callback: (...args: any) => void) {
    //TODO: add support for "onAny"
    throw new NotImplementedError("onAny");
  }

  prependAny(callback: (...args: any) => void) {
    //TODO: add support for "prependAny"
    throw new NotImplementedError("prependAny");
  }

  offAny(callback: (...args: any) => void) {
    //TODO: add support for "offAny"
    throw new NotImplementedError("offAny");
  }

  removeAllListeners(event ? : string) {
    //TODO: add support for "removeAllListeners"
    throw new NotImplementedError("removeAllListeners");
  }

  off(event: string, callback?: (...args: any) => void) {
    if(!callback) {
      delete this.callbacks[event];
    } else { 
      //TODO: add support for "off" with callback
      throw new NotImplementedError("off with callback");
    }
  }

  once(event: string, callback: (...args: any) => void) {
    //TODO: add support for "once"
    this.on(event, callback);
  }

  emit(event: string, ...args: any) {
    if (!this.interceptedRequestSocketEvents.includes(event)) {
      this.emitRealSocket(event, ...args);
    } else {
      try{
        this.interceptRequestCallbacks[event].forEach((callback: (...args: any) => void) => {
          callback(...args);
        });
      } catch(e) {
        //this.interceptRequestCallbacks[event] was deleted by the callbacks
      }
    }
  }
}

export default SocketMock;
