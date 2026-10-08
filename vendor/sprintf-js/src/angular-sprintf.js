angular
  .module('sprintf', [])
  .filter('sprintf', () => () => sprintf.apply(null, arguments))
  .filter('fmt', ['$filter', ($filter) => $filter('sprintf')])
  .filter('vsprintf', () => (format, argv) => vsprintf(format, argv))
  .filter('vfmt', ['$filter', ($filter) => $filter('vsprintf')]);
