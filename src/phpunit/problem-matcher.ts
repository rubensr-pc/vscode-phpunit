import * as yargsParser from 'yargs-parser';
import { Arguments } from 'yargs-parser';

export class EscapeValue {
    private values = {
        escape: ['||', "|'", '|n', '|r', '|]', '|['],
        unescape: ['|', "'", '\n', '\r', ']', '['],
    };

    private patterns: { unescape: RegExp[]; escape: RegExp[] };

    constructor() {
        this.patterns = {
            escape: this.toRegExp(this.values.escape),
            unescape: this.toRegExp(this.values.unescape),
        };
    }

    public escape(value: string | number | object) {
        return this.doEscape(value, this.patterns.unescape, this.values.escape);
    }

    public unescape(value: string | number | object) {
        return this.doEscape(value, this.patterns.escape, this.values.unescape);
    }

    private doEscape(value: string | number | object, from: RegExp[], to: string[]) {
        if (typeof value !== 'string') {
            return value;
        }

        for (const x in from) {
            value = value.replace(from[x], to[x]);
        }

        return value;
    }

    private toRegExp(values: string[]) {
        return values.map((str) => {
            str = str.replace(/([|\]\[])/g, (m) => `\\${m}`);

            return new RegExp(str, 'g');
        });
    }
}

export enum TestEvent {
    testCount = 'testCount',
    testSuiteStarted = 'testSuiteStarted',
    testSuiteFinished = 'testSuiteFinished',
    testStarted = 'testStarted',
    testFailed = 'testFailed',
    testIgnored = 'testIgnored',
    testFinished = 'testFinished',
}

type TestBase = { event: TestEvent; name: string; flowId: number };
type TestSuiteStarted = TestBase & { id?: string; file?: string; locationHint?: string };
type TestSuiteFinished = TestBase;
type TestStarted = TestBase & { id: string; file: string; locationHint: string };
type TestFinished = TestBase & { duration: number };

type TestFailed = TestFinished & {
    message: string;
    details: Array<{ file: string; line: number }>;

    type?: string;
    actual?: string;
    expected?: string;
};

type TestIgnored = TestFailed;
type TestCount = { event: TestEvent; count: number; flowId: number };
type TimeAndMemory = { time: string; memory: string };
type TestResultCount = {
    tests?: number;
    assertions?: number;
    errors?: number;
    failures?: number;
    skipped?: number;
    incomplete?: number;
    risky?: number;
};

type TestResult = TestSuiteStarted &
    TestSuiteFinished &
    TestStarted &
    TestFailed &
    TestIgnored &
    TestFinished;

export type Result = TestResult | TestResultCount | TestCount | TimeAndMemory;

interface IParser<T> {
    is: (text: string) => boolean;
    parse: (text: string) => T;
}

class TestResultCountParser implements IParser<TestResultCount> {
    private readonly pattern = (() => {
        const items = ['Errors', 'Failures', 'Skipped', 'Incomplete', 'Risky'];
        const end = '\\s(\\d+)[\\.\\s,]\\s?';
        const tests = `Tests:${end}`;
        const assertions = `Assertions:${end}`;

        return new RegExp(`^${tests}${assertions}((${items.join('|')}):${end})*`, 'g');
    })();

    public is(text: string) {
        return !!text.match(this.pattern);
    }

    public parse(text: string) {
        const pattern = new RegExp(`(?<name>\\w+):\\s(?<count>\\d+)[\\.\\s,]?`, 'g');

        return [...text.matchAll(pattern)].reduce((result: any, match) => {
            const { name, count } = match.groups!;
            result[name.toLowerCase()] = parseInt(count, 10);

            return result;
        }, {} as TestResultCount);
    }
}

class TimeAndMemoryParser implements IParser<TimeAndMemory> {
    private readonly pattern = new RegExp(
        'Time: (?<time>[\\d+:\\.]+), Memory: (?<memory>[\\d\\.]+\\s\\w+)'
    );

    public is(text: string) {
        return !!text.match(this.pattern);
    }

    public parse(text: string): TimeAndMemory {
        const { time, memory } = text.match(this.pattern)!.groups!;

        return { time, memory };
    }
}

export class Parser implements IParser<Result | undefined> {
    private readonly pattern = new RegExp('^\\s*#+teamcity');
    private readonly detailsPattern = new RegExp('(?<file>.+):(?<line>\\d+)$');
    private readonly parsers = [new TimeAndMemoryParser(), new TestResultCountParser()];

    constructor(private escapeValue: EscapeValue) {}

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
            .replace(/^\[|\]$/g, '');

        const { _, $0, ...argv } = this.unescapeArgv(this.toTeamcityArgv(text));

        return {
            ...argv,
            ...this.parseLocationHint(argv),
            ...this.parseDetails(argv),
        } as TestResult;
    }

    private parseDetails(argv: Pick<Arguments, string | number>) {
        if (!argv.details) {
            return {};
        }

        return {
            details: argv.details
                .trim()
                .split(/\r\n|\n/g)
                .filter((detail: string) => !!detail)
                .map((detail: string) => {
                    const { file, line } = detail.match(this.detailsPattern)!.groups!;

                    return { file, line: parseInt(line, 10) };
                }),
        };
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
        const id = split.join('::');

        return { id, file };
    }

    private unescapeArgv(argv: Pick<Arguments, string | number>) {
        for (const x in argv) {
            argv[x] = this.escapeValue.unescape(argv[x]);
        }

        return argv;
    }

    private toTeamcityArgv(text: string) {
        const [eventName, ...args] = this.parseArgv(text)._;
        const command = [
            `--event='${eventName}'`,
            ...args.map((parameter) => `--${parameter}`),
        ].join(' ');

        return this.parseArgv(command);
    }

    private parseArgv(text: string): Arguments {
        return yargsParser(text);
    }
}

class ProblemMatcher {
    private collect = new Map<string, TestResult>();

    private lookup: { [p: string]: Function } = {
        [TestEvent.testSuiteStarted]: this.handleStarted,
        [TestEvent.testStarted]: this.handleStarted,
        [TestEvent.testSuiteFinished]: this.handleFinished,
        [TestEvent.testFinished]: this.handleFinished,
        [TestEvent.testFailed]: this.handleFault,
        [TestEvent.testIgnored]: this.handleFault,
    };

    constructor(private parser: Parser) {}

    read(
        input: string | Buffer
    ): TestResult | TestCount | TestResultCount | TimeAndMemory | undefined {
        const result = this.parser.parse(input.toString());

        return !result || this.isTestResult(result)
            ? result
            : this.lookup[(result as TestResult).event]?.call(this, result as TestResult);
    }

    private isTestResult(result: any) {
        return !(
            result.hasOwnProperty('event') &&
            result.hasOwnProperty('name') &&
            result.hasOwnProperty('flowId')
        );
    }

    private handleStarted(result: TestResult) {
        const id = this.generateId(result);
        this.collect.set(id, { ...result });

        return this.collect.get(id);
    }

    private handleFault(result: TestResult) {
        const id = this.generateId(result);
        const prevData = this.collect.get(id);
        this.collect.set(id, { ...prevData, ...result });
    }

    private handleFinished(result: TestResult) {
        const id = this.generateId(result);

        const prevData = this.collect.get(id)!;
        const event = this.isFault(prevData) ? prevData.event : result.event;
        this.collect.set(id, { ...prevData, ...result, event });

        return this.collect.get(id);
    }

    private isFault(result: TestResult) {
        return [TestEvent.testFailed, TestEvent.testIgnored].includes(result.event);
    }

    private generateId(result: TestResult) {
        return `${result.name}-${result.flowId}`;
    }
}

export const parser = new Parser(new EscapeValue());
export const problemMatcher = new ProblemMatcher(parser);
