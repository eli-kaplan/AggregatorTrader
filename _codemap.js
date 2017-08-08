module.exports = {
  _ns: 'zenbot',

  'strategies.aggregator': require('./strategy'),
  'strategies.list[]': '#strategies.aggregator'
}