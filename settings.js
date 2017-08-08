/**
 * config.js : configuration file for the aggregator algorithm
 * @author Eli Kaplan - eli.kaplan at alumni.ubc.ca
 * 
 */

module.exports = function() {
    return {
        /**
         * algsEnabled : algorithms for the aggregator to use
         */
        algsEnabled : ['rsi', 'macd', 'trend_ema', 'trust_distrust', 'sar', 'speed'],

        /**
         * algSettings : configuation options for each available algorithm
         *      - period : period for alg (in minutes)
         *      - weight : weight of produced buy/sell signal
         *      - params : array of parameters for strategy - see examples
         *      - onLoad : code to run when strategy is run - see forex_analytics below
         */
        algSettings : {
            'rsi' : {
                period : 15,
                weight : 100,
                params : ['rsi_periods = 16', 'overbought_rsi = 82', 'oversold_rsi = 26', 'rsi_recover = 3', 'rsi_drop = 0', 'rsi_divisor = 2'],
                onLoad : null
            },
            
            'macd' : {
                period : 60,
                weight : 100,
                params : ['ema_short_period = 14', 'ema_long_period = 23', 'signal_period = 9', 'up_trend_threshold = 0', 'down_trend_threshold = 0', 'overbought_rsi_periods = 21', 'overbought_rsi = 70'],
                onLoad : null
            },

            'trend_ema' : {
                period : 1,
                weight : 100,
                params : ['trend_ema = 20', 'neutral_rate = 0.06', 'oversold_rsi_periods = 20', 'oversold_rsi = 30'],
                onLoad : null
            },

            'trust_distrust' : {
                period : 30,
                weight : 100,
                params : ['sell_threshold = 2', 'sell_threshold_max = 0', 'sell_min = 1', 'buy_threshold = 2', 'buy_threshold_max = 0', 'greed = 0'],
                onLoad : null
            },

            'sar' : {
                period : 2,
                weight : 50,
                params : ['sar_af = 0.015', 'sar_max_af = 0.1'],
                onLoad : null
            },

            'speed' : {
                period : 1,
                weight : 50,
                params : ['baseline_periods = 5000', 'trigger_factor = 2'],
                onLoad : null
            },

            'forex_analytics' : {
                period : 30,
                weight : 100,
                params : ['modelfile = "models/default_model.json"'],
                onLoad : 'this.data.options.period = "30m"; this.inst.getOptions(this.data)'
            }
        }
    }
}