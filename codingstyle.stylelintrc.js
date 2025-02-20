'use strict';

module.exports = {
	extends: 'stylelint-config-standard',
	plugins: [
		'stylelint-order'
	],
	rules: {
		'order/order': [
			'custom-properties',
			'declarations'
		],
		'order/properties-alphabetical-order': true,
		indentation: 'tab'
	}
};
