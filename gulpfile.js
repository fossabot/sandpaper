/*
Tutorials
	https://www.smashingmagazine.com/2014/06/building-with-gulp/
	https://github.com/osscafe/gulp-cheatsheet
	https://www.youtube.com/watch?v=dwSLFai8ovQ
	https://css-tricks.com/bem-101/

Useful information
	https://www.npmjs.com/package/glob	// handling files and folders
	https://semver.org/					// versioning spec
	https://caniuse.com/#compare
	https://www.npmjs.com/package/gulp-if
	https://github.com/jshint/jshint
	https://www.npmjs.com/package/cssnano
	https://stylelint.io/
	https://github.com/stylelint/stylelint-config-standard
	https://github.com/hudochenkov/stylelint-order

Things to check out
	scss
	ruby on rails
	babel
	gulp-concat
	gulp-alex / Alex
	webpack
	imagemin-pngout
	https://github.com/postcss/postcss
	https://www.npmjs.com/package/gulp-bump
	https://www.npmjs.com/package/csso

Post CSS information
	https://github.com/postcss/gulp-postcss
	https://www.postcss.parts/
	https://github.com/postcss/postcss#plugins
	https://github.com/anandthakker/doiuse
	https://stylelint.io/user-guide/example-config/
	https://github.com/lahmatiy/postcss-csso
	https://www.npmjs.com/package/gulp-postcss
	https://github.com/csstools/postcss-preset-env
	https://github.com/gucong3000/postcss-unprefix
	https://github.com/postcss/autoprefixer
*/

const autoprefixer = require('autoprefixer');
const browserSync = require('browser-sync').create();
const cache = require('gulp-cache');
const changed = require('gulp-changed');
const composer = require('gulp-uglify/composer');
const cssnano = require('cssnano');
const del = require('del');
const eslint = require('gulp-eslint');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const htmlhint = require('gulp-htmlhint');
const htmlmin = require('gulp-htmlmin');
const imagemin = require('gulp-imagemin');
const jshint = require('gulp-jshint');
const mqpacker = require('css-mqpacker');
const postcss = require('gulp-postcss');
const postCSSinHTML = require('gulp-html-postcss');
const postcssReporter = require('postcss-reporter');
const presetEnv = require('postcss-preset-env');
const pump = require('pump');
const stylelint = require('stylelint');
const stylish = require('jshint-more-stylish');
const through2 = require('through2');
const tslint = require('gulp-tslint');
const typescript = require('gulp-typescript');
const uglify = require('uglify-js');
const unprefix = require('postcss-unprefix');
const zip = require('gulp-zip');
const markdownlint = require('markdownlint');

// Unified Engine
const unified = require('unified');
const parse = require('rehype-parse');
const stringify = require('rehype-stringify');
const rehype2retext = require('rehype-retext');
const remark2retext = require('remark-retext');
const engine = require('unified-engine-gulp');

// Retext Modules
const english = require('retext-english');
const contractions = require('retext-contractions');
const dontAssume = require('retext-assuming');
const equality = require('retext-equality');
const indefinite = require('retext-indefinite-article');
const passive = require('retext-passive');
const profanities = require('retext-profanities');
const quotes = require('retext-quotes');
const repeated = require('retext-repeated-words');
const spacing = require('retext-sentence-spacing');
const redundantAcronyms = require('retext-redundant-acronyms');

let SourceMaps = false;
let onlyLintErrors = true;
let staging = true;

const composerUglify = composer(uglify, console);
const currentTime = Date.now;
const landingPage = 'index.html';
const ProjectName = 'gulp-default-project-name';
const ZipName = ProjectName + ' - ' + currentTime;

const pluginsPostCSS = [
	mqpacker(),
	presetEnv({stage: 2 /* Stage 0 - 4 */}),
	unprefix(),
	autoprefixer(),
	cssnano()
];

const uglifyjsOptions = {};

const workingDirectory = 'src';
const paths = {	// This will likely need to be updated for your project.
	src: {
		all: workingDirectory + '/**/*',
		html: workingDirectory + '/**/*.htm*',
		css: workingDirectory + '/**/*.css',
		js: workingDirectory + '/**/*.js',
		ts: workingDirectory + '/**/*.ts',
		php: workingDirectory + '/**/*.php',
		md: workingDirectory + '/**/*.md',
		images: workingDirectory + '/**/*.+(png|jpg|gif|svg)',
		leftovers: '!' + workingDirectory + '/**/*.+(htm*|css|js|ts|png|jpg|gif|svg)' // All files that aren't of the mime type listed above.
	},
	dev: {
		all: 'dev',
		html: 'dev',
		css: 'dev',
		js: 'dev',
		ts: 'dev',
		php: 'dev',
		md: 'dev',
		images: 'dev'
	},
	prod: {
		all: 'dist',
		html: 'dist',
		css: 'dist',
		js: 'dist',
		ts: 'dist',
		php: 'dist',
		md: 'dist',
		images: 'dist'
	},
	report: {
		css: 'report/css'
	},
	index: landingPage, // The .html file to open when running gulp sync.
	basedir: './dev',	// The folder that gulp sync loads from.
	sourcemaps: './sourcemaps'
};
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function releaseMode() {
	staging = false;
	return Promise.resolve('staging');
}

function strictLint() {
	onlyLintErrors = false;
	return Promise.resolve('fullLint');
}

function includeSourceMaps() {
	SourceMaps = true;
	return Promise.resolve('SourceMaps');
}

async function clean() {
	cache.clearAll();
	await del(gulpif(staging, paths.dev.all, paths.prod.all));
	await sleep(1000); // Wait 1 second to give the disk enough time to delete the old version.
	return Promise.resolve('Cleaned');
}

function copyAssets() {
	return gulp.src([paths.src.all, paths.src.leftovers]) // All files that aren't of the mime type listed in paths.rel.leftovers
		.pipe(gulp.dest(gulpif(staging, paths.dev.all, paths.prod.all)));
}

// From https://github.com/doshprompt/htmlhint-stylish/issues/1#issuecomment-251012229
function htmlReporter(file) {
	return stylish.reporter(file.htmlhint.messages.map(errMsg => ({
		file: require('path').relative(file.cwd, errMsg.file),
		error: {
			character: errMsg.error.col,
			code: errMsg.error.rule.id,
			line: errMsg.error.line,
			reason: errMsg.error.message
		}
	})));
}

function compileCSS() {
	return gulp.src(paths.src.css, {sourcemaps: SourceMaps})
		.pipe(changed(gulpif(staging, paths.dev.css, paths.prod.css)))
		.pipe(postcss(pluginsPostCSS))
		.pipe(gulp.dest(gulpif(staging, paths.dev.css, paths.prod.css), {sourcemaps: paths.sourcemaps}))
		.pipe(browserSync.stream());
}

function compileHTML() {
	return gulp.src(paths.src.html, {sourcemaps: SourceMaps})
		.pipe(changed(gulpif(staging, paths.dev.html, paths.prod.html)))
		.pipe(postCSSinHTML(pluginsPostCSS))
		.pipe(htmlmin({
			collapseInlineTagWhitespace: true,
			collapseWhitespace: true,
			minifyCSS: true,
			minifyJS: true,
			minifyURLs: true,
			removeComments: true,
			html5: true,
			useShortDoctype: true
		}))
		.pipe(gulp.dest(gulpif(staging, paths.dev.html, paths.prod.html), {sourcemaps: paths.sourcemaps}))
		.pipe(browserSync.stream());
}

function compileTS() {
	return gulp.src(paths.src.ts, {sourcemaps: SourceMaps})
		.pipe(typescript(
			{
				/* Options that are currently unused
				experimentalAsyncFunctions: true,
				target: 'ES6' // 'ES3' (default), 'ES5' or 'ES6'.
				*/
			}))
		.pipe(gulp.dest(gulpif(staging, paths.dev.js, paths.prod.js), {sourcemaps: paths.sourcemaps}))
		.pipe(browserSync.stream());
}

function uglifyjs(cb) {
	return pump([
		gulp.src(paths.src.js, {sourcemaps: SourceMaps}),
		changed(gulpif(staging, paths.dev.js, paths.prod.js)),
		composerUglify(uglifyjsOptions),
		gulp.dest(gulpif(staging, paths.dev.js, paths.prod.js), {sourcemaps: paths.sourcemaps})
	],
	browserSync.stream(),
	cb
	);
}

function optamizeImages() {
	return gulp.src(paths.src.images)
		.pipe(changed(gulpif(staging, paths.dev.html, paths.prod.html)))
		.pipe(cache(imagemin([
			imagemin.gifsicle({interlaced: false}, {optimizationLevel: gulpif(staging, 1, 3)}), // Optimization level can be 1 - 3
			imagemin.jpegtran({progressive: false}),
			imagemin.optipng({optimizationLevel: gulpif(staging, 1, 7)}), // OptimizationLevel: 0 - 7 (5 is a good tradeoff if 7 takes too long.)
			imagemin.svgo({
				plugins: [
					{cleanupAttrs: true},
					{removeDoctype: true},
					{removeXMLProcInst: true},
					{removeComments: true},
					{removeMetadata: true},
					{removeTitle: true},
					{removeDesc: true},
					{removeUselessDefs: true},
					{removeXMLNS: false}, // Setting this to true will break the image
					{removeEditorsNSData: true},
					{removeEmptyAttrs: true},
					{removeHiddenElems: true},
					{removeEmptyText: true},
					{removeEmptyContainers: true},
					{removeViewBox: true},
					{cleanupEnableBackground: true},
					{minifyStyles: true},
					{convertStyleToAttrs: true},
					{convertColors: true},
					{convertPathData: true},
					{convertTransform: true},
					{removeUnknownsAndDefaults: true},
					{removeNonInheritableGroupAttrs: true},
					{removeUselessStrokeAndFill: true},
					{removeUnusedNS: true},
					{cleanupIDs: true},
					{cleanupNumericValues: true},
					{cleanupListOfValues: true},
					{moveElemsAttrsToGroup: true},
					{moveGroupAttrsToElems: true},
					{collapseGroups: true},
					{removeRasterImages: true},
					{mergePaths: true},
					{convertShapeToPath: true}
				]
			})
			/* Should look into using pngout again at some point. */ // imageminPngout()
		], {verbose: true})))
		.pipe(gulp.dest(gulpif(staging, paths.dev.images, paths.prod.images)));
}

function linthtml() {
	if (onlyLintErrors) {
		return gulp.src(paths.src.html)
			.pipe(htmlhint())
			.pipe(htmlhint.reporter(htmlReporter));
	}

	// Else
	return gulp.src(paths.src.html)
		.pipe(htmlhint({
			'alt-require': true,
			'attr-lowercase': true,
			'attr-no-duplication': true,
			'attr-unsafe-chars': true,
			'attr-value-double-quotes': true,
			'attr-value-not-empty': true,
			'doctype-first': true,
			'doctype-html5': true,
			'head-script-disabled': true,
			'href-abs-or-rel': false,
			'id-class-ad-disabled': true,
			'id-unique': true,
			'inline-script-disabled': false,
			'inline-style-disabled': false,
			'space-tab-mixed-disabled': 'tab',
			'spec-char-escape': true,
			'src-not-empty': true,
			'style-disabled': false,
			'tag-pair': true,
			'tag-self-close': true,
			'tagname-lowercase': true,
			'title-require': true
		}))
		.pipe(htmlhint.reporter(htmlReporter));
}

function lintcss() {
	let pluginsPostCSSlint;
	if (onlyLintErrors) {
		pluginsPostCSSlint = [
			stylelint({configFile: 'errors-only.stylelintrc.js'}),
			postcssReporter({clearReportedMessages: true})
		];
	} else {
		pluginsPostCSSlint = [
			stylelint({configFile: 'codingstyle.stylelintrc.js'}),
			postcssReporter({clearReportedMessages: true})
		];
	}

	return gulp.src(paths.src.css)
		.pipe(postcss(pluginsPostCSSlint));
}

function lintjs() {
	if (onlyLintErrors) {
		return gulp.src(paths.src.js)
			.pipe(jshint())
			.pipe(jshint.reporter(stylish));
	}

	return gulp.src(paths.src.js)
		.pipe(eslint({configFile: 'node_modules/eslint-config-xo/index.js'})) // If error try npm install eslint-config-xo
		.pipe(eslint.format('stylish'));
}

function lintts() {
	return gulp.src(paths.src.ts)
		.pipe(tslint({formatter: 'stylish'}))
		.pipe(tslint.report({emitError: false}));
}

function lintmd() {
	return gulp.src(paths.src.md, {read: false})
		.pipe(through2.obj((file, enc, next) => {
			markdownlint(
				{files: [workingDirectory + '/' + file.relative]},
				(err, result) => {
					console.log(result.toString());
					next(err, file);
				});
		}));
}

function lintmarkdownContent() {
	return gulp.src(paths.src.md)
		.pipe(
			engine({name: 'gulp-unified', processor: require('unified')})()
				.use(parse)
				.use(
					remark2retext,
					unified()
						.use([
							english,
							contractions,
							dontAssume,
							equality,
							indefinite,
							passive,
							profanities,
							redundantAcronyms,
							repeated,
							spacing
						])
						.use(quotes, {preferred: 'straight'})
				)
				.use(stringify)
		);
}

function lintHtmlContent() {
	return gulp.src(paths.src.html)
		.pipe(
			engine({name: 'gulp-unified', processor: require('unified')})()
				.use(parse)
				.use(
					rehype2retext,
					unified()
						.use([
							english,
							contractions,
							dontAssume,
							equality,
							indefinite,
							passive,
							redundantAcronyms,
							repeated,
							spacing
						])
						.use(quotes, {preferred: 'straight'})
				)
				.use(stringify)
		);
}

function zipSrc() {
	return gulp.src(paths.src.all)
		.pipe(zip(ZipName))
		.pipe(gulp.dest(paths.prod.all));
}

function watch() {
	gulp.watch(paths.src.html, compileHTML);
	gulp.watch(paths.src.css, compileCSS);
	gulp.watch(paths.src.js, uglifyjs);
	gulp.watch(paths.src.ts, compileTS);
	gulp.watch(paths.src.images, optamizeImages);
	gulp.watch(paths.src.leftovers, copyAssets);
}

function watchlint() {
	gulp.watch(paths.src.html, linthtml);
	gulp.watch(paths.src.css, lintcss);
	gulp.watch(paths.src.js, lintjs);
	gulp.watch(paths.src.ts, lintts);
}

function syncBrowsers() {
	browserSync.init({
		server: {
			baseDir: paths.basedir,
			index: paths.index
		}
	});
	gulp.watch(paths.src.html, compileHTML).on('change', browserSync.reload);
	gulp.watch(paths.src.css, compileCSS).on('change', browserSync.reload);
	gulp.watch(paths.src.js, uglifyjs).on('change', browserSync.reload);
	gulp.watch(paths.src.ts, compileTS).on('change', browserSync.reload);
	gulp.watch(paths.src.images, optamizeImages).on('change', browserSync.reload);
	gulp.watch(paths.src.leftovers, copyAssets).on('change', browserSync.reload);
}

exports.clean = clean;
exports.compileCSS = compileCSS;
exports.compileHTML = compileHTML;
exports.compileTS = compileTS;
exports.copyAssets = copyAssets;
exports.htmlReporter = htmlReporter;
exports.includeSourceMaps = includeSourceMaps;
exports.lintcss = lintcss;
exports.linthtml = linthtml;
exports.lintjs = lintjs;
exports.lintts = lintts;
exports.lintmd = lintmd;
exports.lintmarkdownContent = lintmarkdownContent;
exports.lintHtmlContent = lintHtmlContent;
exports.optamizeImages = optamizeImages;
exports.releaseMode = releaseMode;
exports.strictLint = strictLint;
exports.syncBrowsers = syncBrowsers;
exports.uglifyjs = uglifyjs;
exports.watch = watch;
exports.watchlint = watchlint;
exports.zipSrc = zipSrc;

// Combined functions / jobs

const lint = gulp.series(
	linthtml,
	lintcss,
	lintjs,
	lintts,
	lintmd,
	lintmarkdownContent
);

const batchEverthing = gulp.series(
	gulp.parallel(
		compileCSS,
		compileHTML,
		uglifyjs,
		compileTS,
		optamizeImages,
		copyAssets
	),
	lint
);

const test = gulp.series(
	includeSourceMaps,
	batchEverthing,
	releaseMode,
	batchEverthing,
	lint,
	strictLint,
	lint,
	lintHtmlContent,
	zipSrc
);

const buildDev = gulp.series(
	includeSourceMaps,
	batchEverthing
);

const buildProd = gulp.series(
	releaseMode,
	batchEverthing
);

const lintStrict = gulp.series(
	strictLint,
	lint,
	lintHtmlContent
);

const sync = gulp.series(
	includeSourceMaps,
	batchEverthing,
	syncBrowsers
);

const watchLint = gulp.series(
	lint,
	watchlint
);

const watchlintstrict = gulp.series(
	strictLint,
	lint,
	watchlint
);

exports.buildDev = buildDev;
exports.buildProd = buildProd;
exports.lintStrict = lintStrict;
exports.sync = sync;
exports.watchLint = watchLint;
exports.watchlintstrict = watchlintstrict;

gulp.task('default', buildDev);
gulp.task('prod', buildProd);
gulp.task('lint', lint);
gulp.task('lintstrict', lintStrict);
gulp.task('zip', zipSrc);
gulp.task('sync', sync);
gulp.task('watchlint', watchLint);
gulp.task('watchlintstrict', watchlintstrict);
gulp.task('test', test);
