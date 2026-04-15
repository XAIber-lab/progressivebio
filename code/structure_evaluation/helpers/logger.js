const fs = require('fs');
const util = require('util');

module.exports = function setupLogger() {
    const logFile = fs.createWriteStream('./rome/results/console.log', {flags: 'a'});

    const logToFile = (message) => {
        // Ensure message formatting is correct
        const formattedMessage = util.format(...message) + '\n';
        logFile.write(formattedMessage, (err) => {
            if (err) {
                // Use console.error to log any file writing errors
                console.error('Error writing to log file:', err);
            }
        });
    };

    // Override console.log
    const originalConsoleLog = console.log;
    console.log = (...args) => {
        //process.stdout.write(`console.log called with: ${util.format(...args)}\n`);
        // debugging the console.log... smh
        originalConsoleLog(...args);
        logToFile(args);
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // This is completely redundant since console.log itself captures everything...

    /*
    // Keep a reference to the original console.time and console.timeEnd
    const originalConsoleTime = console.time;
    const originalConsoleTimeEnd = console.timeEnd;
    const originalConsoleTimeLog = console.timeLog;

    // Override console.time
    const timers = {};
    console.time = (label) => {
        originalConsoleTime(label);  // Use the original console.time for console output
        timers[label] = [Date.now(), performance.now()];
    };

    // Override console.timeEnd
    console.timeEnd = (label) => {
        originalConsoleTimeEnd.call(console, label);  // Use the original console.timeEnd for console output
        if (timers[label]) {
            handleTime(timers, label);
        }
    };

    // Override console.timeLog (if necessary, as not all environments support it)
    if (console.timeLog) {
        console.timeLog = (label, ...data) => {
            originalConsoleTimeLog.call(console, label, ...data);  // Use the original console.timeLog for console output
            if (timers[label]) {
                handleTime(timers, label);
            }
        };
    }

    function handleTime(timers, label) {
        const duration = Date.now() - timers[label][0];
        const perfDuration = performance.now() - timers[label][1]
        let message = `${label}:`
        if (duration > 59999) {
            message += ` ${millisecondsToTimeFormat(duration)} (m:ss.mmm)`;
        } else if (duration > 999) {
            message += ` ${millisecondsToSecondsMilliseconds(duration)}s`;
        } else {
            message += ` ${perfDuration.toFixed(3)}ms`;
        }

        //logToFile([message]);
    }

    function millisecondsToTimeFormat(milliseconds) {
        // Calculate minutes, seconds, and milliseconds
        const minutes = Math.floor(milliseconds / 60000);
        milliseconds %= 60000;
        const seconds = Math.floor(milliseconds / 1000);
        milliseconds %= 1000;

        // Format the time components as strings with leading zeros if necessary
        const minutesString = String(minutes).padStart(2, '0');
        const secondsString = String(seconds).padStart(2, '0');
        const millisecondsString = String(milliseconds).padStart(3, '0');

        // Concatenate the formatted components to create the time format string
        return `${minutesString}:${secondsString}.${millisecondsString}`;

    }

    function millisecondsToSecondsMilliseconds(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        milliseconds %= 1000;
        const secondsString = String(seconds);
        const millisecondsString = String(milliseconds).padStart(3, '0');
        return `${secondsString}.${millisecondsString}`;
    }
    */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
};