import { Certificate, CertificateRequest, ExportedCertificate } from '../shared/types';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { log } from './log';

export class certgen {
    public static certgenExePath: string = undefined;

    private static async runCertgen(action: 'PING' | 'IMPORT_CERTIFICATE' | 'EXPORT_CERTIFICATES' | 'GET_VERSION', config: unknown): Promise<string> {
        return new Promise((resolve, reject) => {
            let process: ChildProcessWithoutNullStreams;
            try {
                log.debug(certgen.certgenExePath, [action]);
                process = spawn(certgen.certgenExePath, [action]);
            } catch (err) {
                log.error('Error spawning process', err);
                reject(err);
                return;
            }

            let output = '';
            process.stdout.on('data', data => {
                log.debug('stdout', data.toString());
                output += data;
            });

            let error = '';
            process.stderr.on('data', data => {
                log.error('stderr', data.toString());
                error += data;
            });

            process.on('close', code => {
                if (code === 0) {
                    resolve(output);
                } else {
                    log.error('Certgen error', { code: code, error: error });
                    reject(error.trim());
                }
            });

            process.stdin.write(JSON.stringify(config));
            process.stdin.end();
        });
    }

    public static async test(): Promise<void> {
        const config = {
            Nonce: 'hello world'
        };

        interface pingRespone {
            OK: boolean;
            Nonce: string;
        }

        return this.runCertgen('PING', config).then(output => {
            const response = JSON.parse(output) as pingRespone;
            if (!response.OK || response.Nonce !== config.Nonce) {
                throw new Error('Invalid response from certgen backend');
            }
        });
    }

    public static async importCertificate(data: string, password: string): Promise<Certificate> {
        const config = {
            Data: data,
            Password: password,
        };

        log.debug('Importing certificate', config);
        return this.runCertgen('IMPORT_CERTIFICATE', config).then(output => {
            return JSON.parse(output) as Certificate;
        });
    }

    public static async exportCertificates(exportDir: string, requests: CertificateRequest[], importedRoot: Certificate, includeCA: boolean, format: string, password: string): Promise<ExportedCertificate> {
        const config = {
            ExportDir: exportDir,
            Requests: requests,
            ImportedRoot: importedRoot,
            IncludeCA: includeCA,
            Format: format,
            Password: password,
        };

        log.debug('Exporting certificate', config);
        return this.runCertgen('EXPORT_CERTIFICATES', config).then(output => {
            return JSON.parse(output) as ExportedCertificate;
        });
    }

    public static async getVersion(): Promise<string> {
        interface responseType {
            Version: string;
        }

        return this.runCertgen('GET_VERSION', {}).then(output => {
            const response = JSON.parse(output) as responseType;
            return response.Version;
        });
    }
}