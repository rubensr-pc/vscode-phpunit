import { Filesystem, POSIX, WINDOWS } from './';
import { isWindows } from '../helpers';

export class Factory {
    public platform: string = process.platform;

    create(): Filesystem {
        return isWindows(this.platform) ? new WINDOWS() : new POSIX();
    }
}