// NOTE: this solution assumes that the requested parsing (through the parseNow API end point) is
//    done on the same process as the API server, even if the automatic parsing is done in a separate
//    process. In the future, it might be worth modifying it so the parsing is done on the same
//    process where the automatic parsing in done.
function ParseControl(loggingOn = false) {
  this.loggingOn = loggingOn;
  this.isDoingParse = false;
  this.pendingParses = [];
  this.pendingProcs = [];
}

ParseControl.prototype.doParse = function (parseFunc, parseCallback) {
  log.call(this, '>>>>>> ParseControl: doParse() method called');
  if (this.isDoingParse) {
    log.call(this, '>>>>>> ParseControl: already doing parse; postpone new parsing');
    this.pendingParses.push({
      timestamp: Date.now(),
      parseFunc: parseFunc,
      parseCallback: parseCallback
    });
  }
  else {
    this.isDoingParse = true;

    log.call(this, '>>>>>> ParseControl: starting parsing');
    try {
      parseFunc(finalizeParsing.bind(this, parseCallback));
    }
    catch (err) {
      log.call(this, '>>>>>> ParseControl: error executing parse function:', err);
      finalizeParsing.call(this, parseCallback);
    }
  }
};

ParseControl.prototype.doProcess = function (procFunc) {
  log.call(this, '>>>>>> ParseControl: doProcess() method called (process func:', procFunc.name, '\b)');
  if (this.isDoingParse) {
    log.call(this, '>>>>>> ParseControl: doing parsing; postpone new processing');
    this.pendingProcs.push({
      timestamp: Date.now(),
      procFunc: procFunc
    })
  }
  else {
    log.call(this, '>>>>>> ParseControl: do processing (process func:', procFunc.name, '\b)');
    try {
      procFunc();
    }
    catch (err) {
      log.call(this, '>>>>>> ParseControl: error executing process function (process func:', procFunc.name, '\b):', err);
    }
  }
};

function finalizeParsing(parseCallback, err) {
  log.call(this, '>>>>>> ParseControl: finalizing parsing');
  this.isDoingParse = false;

  let parseEntry = undefined;

  if (this.pendingParses.length > 0) {
    parseEntry = this.pendingParses.shift();
  }

  if (this.pendingProcs.length > 0) {
    const processNowProcs = [];
    const newPendingProcs = [];

    this.pendingProcs.forEach((procEntry) => {
      if (parseEntry === undefined || procEntry.timestamp < parseEntry.timestamp) {
        processNowProcs.push(procEntry);
      }
      else {
        newPendingProcs.push(procEntry);
      }
    });

    if (processNowProcs.length > 0) {
      this.pendingProcs = newPendingProcs;

      processNowProcs.forEach((procEntry) => {
        log.call(this, '>>>>>> ParseControl: do pending processing (process func:', procEntry.procFunc.name, '\b)');
        try {
          procEntry.procFunc();
        }
        catch (err) {
          log.call(this, '>>>>>> ParseControl: error executing process function (process func:', procEntry.procFunc.name, '\b):', err);
        }
      });
    }
  }

  if (parseEntry !== undefined) {
    log.call(this, '>>>>>> ParseControl: prepare to do pending parsing');
    if (err) {
      log.call(this, '>>>>>> ParseControl: error during last parsing:', err);
    }

    this.doParse(parseEntry.parseFunc, parseEntry.parseCallback || parseCallback);
  }
  else if (parseCallback) {
    log.call(this, '>>>>>> ParseControl: calling parse callback');
    parseCallback(err);
  }
  else if (err) {
    log.call(this, '>>>>>> ParseControl: error during last parsing:', err);
  }
}

function log() {
  if (this.loggingOn) {
    const logArgs = [new Date().toISOString()].concat(Array.from(arguments));

    console.log.apply(undefined, logArgs);
  }
}

module.exports = ParseControl;