import * as yargsParser from 'yargs-parser';
import { Arguments } from 'yargs-parser';
import { escapeValue } from '../../utils';
import { IParser, Result, TestResult } from './types';
import { TestVersionParser } from './test-version-parser';
import { TestProcessesParser } from './test-processes-parser';
import { TestRuntimeParser } from './test-runtime-parser';
import { TestConfigurationParser } from './test-configuration-parser';
import { TestResultSummaryParser } from './test-result-summary-parser';
import { TimeAndMemoryParser } from './time-and-memory-parser';

export class TestResultParser implements IParser<Result | undefined> {
    private readonly pattern = new RegExp('^\\s*#+teamcity');
    private readonly filePattern = new RegExp('(s+)?(?<file>.+):(?<line>\\d+)$');
    private readonly parsers = [
        new TestVersionParser(),
        new TestRuntimeParser(),
        new TestConfigurationParser(),
        new TestProcessesParser(),
        new TimeAndMemoryParser(),
        new TestResultSummaryParser(),
    ];

    constructor() {
    }

    public parse(text: string): Result | undefined {
        return this.is(text)
            ? this.doParse(text)
            : this.parsers.find((parser) => parser.is(text))?.parse(text);
    }

    public is(text: string): boolean {
        return !!text.match(this.pattern);
    }

    private doParse(text: string) {
        text = text
            .trim()
            .replace(this.pattern, '')
            .replace(/^\[|]$/g, '');

        const argv = this.toTeamcityArgv(text);
        argv.kind = argv.event;

        return {
            ...argv,
            ...this.parseLocationHint(argv),
            ...this.parseDetails(argv),
        } as TestResult;
    }

    private parseDetails(argv: Pick<Arguments, string | number>) {
        if (!('details' in argv)) {
            return {};
        }

        let message = argv.message;
        const details = this.parseFileAndLine(argv.message);
        details.forEach(({ file, line }) => {
            message = message.replace(`${file}:${line}`, '');
        });

        return {
            message: message.trim(),
            details: [...details, ...this.parseFileAndLine(argv.details)],
        };
    }

    private parseFileAndLine(text: string) {
        return text
            .trim()
            .split(/\r\n|\n/g)
            .filter((input: string) => input.match(this.filePattern))
            .map((input: string) => {
                const { file, line } = input.match(this.filePattern)!.groups!;

                return {
                    file: file.replace(/^(-)+/, '').trim(),
                    line: parseInt(line, 10),
                };
            });
    }

    private parseLocationHint(argv: Pick<Arguments, string | number>) {
        if (!argv.locationHint) {
            return {};
        }

        const locationHint = argv.locationHint;
        const split = locationHint
            .replace(/^php_qn:\/\//, '')
            .replace(/::\\/g, '::')
            .split('::');

        const file = split.shift();

        let type = file.substring(file.indexOf('/tests/') + 7);
        type = type.substring(0, type.indexOf('/'));

        const id = split.join('::');
        const testId = type + '.' + id.replace(/\swith\sdata\sset\s[#"].+$/, '');

        return { id, file, testId };
    }

    private toTeamcityArgv(text: string): Pick<Arguments, string | number> {
        text = escapeValue.escapeSingleQuote(text) as string;
        text = escapeValue.unescape(text) as string;

        const [eventName, ...args] = yargsParser(text)._;
        const command = [
            `--event='${eventName}'`,
            ...args.map((parameter) => `--${parameter}`),
        ].join(' ');

        const { _, $0, ...argv } = yargsParser(command);

        return escapeValue.unescapeSingleQuote(argv);
    }
}

export const parser = new TestResultParser();
