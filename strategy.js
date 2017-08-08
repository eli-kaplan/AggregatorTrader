/**
 * strategy.js : aggregator trading strategy for zenbot
 * @author Eli Kaplan - eli.kaplan at alumni.ubc.ca
 * @version 1.0
 * 
 * Combines sell/buy signals from other strategies to determine a position to hold.
 * Adjust settings in settings.js. 
 */

var z = require('zero-fill')
,   n = require('numbro')

/**
 * Strategies data 
 */
var algs = {} // 'strategy' : object

/**
 * Signal data
 */
var sigTotal = 0, // numerical representation of overall signal (+ = buy, - = sell, <sigThreshold = hold)
    sigOld = null, // previous signal (buy/sell/hold)
    pctOld = null, // previous percent to buy/sell
    sigThreshold = 0, // threshold for signal to activate - set at runtime by calculateThreshold()
    sigPossible = 0 // total possible signal from all strategies  - set at runtime "

/**
 * Period tick counter data
 */
var periodTick = 0, // minutes
    periodMax = 120 // minutes

/**
 * StrategyWrapper: dynamic strategy wrapper with strategy and parameters specified at runtime
 */
class StrategyWrapper {
    /**
     * constructor() : creates wrapped strategy object
     * @param {*} strategy name of strategy to use
     * @param {*} period period for given strategy
     * @param {*} signalWeight weight of strategy's buy/sell signals
     * @param {*} get from global strategy
     * @param {*} set from global strategy
     * @param {*} clear from global strategy
     * @param {*} params parameters for strategy in form: ['option1 = 2', 'option2 = 3', ...]
     * @param {*} onLoad code to run when strategy is loaded (optional, null to disable)
     */
    constructor(strategy, period, signalWeight, get, set, clear, params, onLoad) {
        this.inst = require('../' + strategy + '/strategy.js')(get, set, clear) // import the strategy
        this.signal = 'hold' // default to hold
        this.period = period
        this.signalWeight = signalWeight
        this.parameters = params

        // Local period/etc data storage - allows multiple strategies to run without interfering with each other
        this.data = {
            in_preroll: false, // by the time the wrapper's onPeriod is called, we are past the preroll period.
            options: {},
            period: {},
            lookback: [],
            my_trades: []
        }

        this.inst.option = function() {}
        this.copyLocalOptions()

        if(onLoad !== null) {
            eval(onLoad)
        }

        algs[strategy] = this
    }

    cb() {
        // empty callback
    }

    /**
     * copyOptions() : copy load-time specified parameters to this.data
     */
    copyLocalOptions() {
        for(var p in this.parameters) {
            eval('this.data.options.' + this.parameters[p])
        }
    }    

    /**
     * copyData() : copy needed period/etc data over to class-local storage
     */
    copyData(s) {
        this.data.options = s.options // copy global options
        this.copyLocalOptions()

        this.data.period = s.period
        this.data.lookback = s.lookback
        this.data.my_trades = s.my_trades
    }

    calculate(s) {
        this.copyData(s)
        this.inst.calculate(this.data)
    }

    onPeriod(s) {
        this.inst.onPeriod(this.data, this.cb)
        this.signal = this.data.signal

        if(this.signal == null) { // default to hold if no signal received
            this.signal = 'hold'
        }
    }

    onReport(s) {
        return this.inst.onReport(this.data)
    }
}

/**
 * setupAlgs() : instantiate classes for each strategy specified in config file
 */
function setupAlgs(get, set, clear) {
    var config = require('./settings.js')()
    var algsEnabled = config.algsEnabled
    var algSettings = config.algSettings

    for(var k in algsEnabled) {
        var algName = algsEnabled[k]
        if(!(algName in algs)) {
            new StrategyWrapper(algName, algSettings[algName].period, algSettings[algName].weight, get, set, clear, algSettings[algName].params, algSettings[algName].onLoad)
        }
    }

}

/**
 * printSignalForEach() : logs buy/sell/hold decisions to console
 */
function printSignalForEach(sigOverall, percent) {
    var logString = '\n>> aggregator decided to ' + sigOverall
    if(sigOverall != 'hold') {
        logString += ' ' + percent + '%'
    }
    logString += ' - signal: ' + Math.abs(sigTotal) + '/' + sigThreshold
    console.log(logString)

    /*
    for(var k in algs) {
        console.log(" - " + k + " is signalling " + algs[k].signal + " / influence: " + algs[k].signalWeight)
    }
    */
}

/**
 * calculateThreshold() : calculate the signal threshold based on total possible signal from all algorithms
 */
function calculateThreshold() {
    sigPossible = 0
    for(var k in algs) {
        sigPossible += algs[k].signalWeight
    }

    sigThreshold = Math.ceil(sigPossible / 2)
}


/**
 * processSignals() : process sell/buy signals with 'influence' weights in array
 */
function processSignals(s) {
    sigTotal = 0
    calculateThreshold()

    for(var k in algs) {
        if(algs[k].signal == 'sell') {
            sigTotal -= algs[k].signalWeight
        } else if(algs[k].signal == 'buy') {
            sigTotal += algs[k].signalWeight
        } // hold doesn't affect sigTotal - threshold handles this
    }

    var pctToTrade = 0
    // Convert combined weighted signal number to buy/sell/hold - holding if below threshold
    if(Math.abs(sigTotal) >= sigThreshold) {
        pctToTrade = Math.round((Math.abs(sigTotal) / sigPossible) * 100)
        if(sigTotal > 0) {
            s.signal = 'buy'
            s.options.buy_pct = pctToTrade
        } else if(sigTotal < 0) {
            s.signal = 'sell'
            s.options.sell_pct = pctToTrade
        } 
    } else {
        s.signal = 'hold'
    }

    // If the signal changes, log what the signal is changed to and why
    if(sigOld != s.signal || pctOld != pctToTrade) {
        printSignalForEach(s.signal, pctToTrade)
        sigOld = s.signal
        pctOld = pctToTrade
    }
}



/**
 * module.exports: function container exported by the strategy module
 */
module.exports = function container (get, set, clear) {
    return {
        name: 'aggregator',
        description: 'Aggregates multiple trading strategies democratically',

        getOptions: function () {
            this.option('period', 'base tick time - probably don\'t want to change.', String, '1m') // determines rate at which onPeriod() runs
            this.option('min_periods', 'min. # history periods', Number, 40)
            setupAlgs(get, set, clear)
        },

        calculate: function(s) {
            for(var k in algs) {
                algs[k].calculate(s)
            }
        },

        onPeriod: function(s, cb) {
            if (s.in_preroll) return cb()
            
            /**
             * Period divider - onPeriod is run every minute (default) but counter must be used
             * to run slower strategies every # ticks
             */
            if(periodTick < periodMax) {
                for(var k in algs) {
                    if((periodTick % algs[k].period) == 0) {
                        algs[k].onPeriod(s)
                    }
                }
                periodTick++
            } else {
                periodTick = 0
            }

            /**
             * Process signals from each algorithm before callback
             */
            processSignals(s)

            cb()

        },

        /**
         * onReport() : generate status visual for console
         */
        onReport: function(s) {
            var colString = '| '
            for(var k in algs) {
                colString += k + ':'
                if(algs[k].signal == 'buy') {
                    colString += 'B'
                } else if(algs[k].signal == 'sell') {
                    colString += 'S'
                } else {
                    colString += 'H'
                }
                colString += ' | '
            }
            colString += '-> '
            if(sigTotal < 0) {
                colString += 'sell'
            } else if(sigTotal > 0) {
                colString += 'buy'
            } else {
                colString += 'hold'
            }
            colString += ' @ ' + sigTotal + '/' + sigThreshold
            return colString.split()
        }
    }
}


/**
 * TODO:
 * - maybe train the algorithm to dynamically calculate signal weights based on historical accuracy (future!)
 * - allow user-specified conditions for when to use each algorithm?
 *      - make this automatic?
 * - allow user-specified signal threshold in options
 */