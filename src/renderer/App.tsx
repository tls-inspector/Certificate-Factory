import * as React from 'react';
import { AlternateNameType, Certificate, CertificateRequest, KeyType } from '../shared/types';
import { CertificateList } from './components/CertificateList';
import { Calendar } from './services/Calendar';
import { Button } from './components/Button';
import { CertificateEdit } from './components/CertificateEdit';
import { IPC } from './services/IPC';
import { Icon } from './components/Icon';
import { Validator } from './services/Validator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Rand } from './services/Rand';
import { Link } from './components/Link';
import '../../css/App.scss';

const blankRequest = (isRoot: boolean): CertificateRequest => {
    const request: CertificateRequest = {
        KeyType: KeyType.ECDSA,
        Subject: {
            Organization: '',
            City: '',
            Province: '',
            Country: '',
            CommonName: '',
        },
        Validity: {
            NotBefore: Calendar.now(),
            NotAfter: Calendar.addDays(365),
        },
        AlternateNames: [],
        Usage: {
            DigitalSignature: true,
            CertSign: true,
        },
        IsCertificateAuthority: true
    };

    if (!isRoot) {
        request.AlternateNames = [
            {
                Type: AlternateNameType.DNS,
                Value: ''
            }
        ];
        request.Usage = {
            DigitalSignature: true,
            KeyEncipherment: true,
            ServerAuth: true,
            ClientAuth: true,
        };
        request.IsCertificateAuthority = false;
    }

    return request;
};

interface AppState {
    importedRoot?: Certificate;
    certificates: CertificateRequest[];
    selectedCertificateIdx: number;
    certificateEditKey: string;
}
export const App: React.FC = () => {
    const [State, setState] = React.useState<AppState>({
        certificates: [blankRequest(true)],
        selectedCertificateIdx: 0,
        certificateEditKey: Rand.ID(),
    });
    const [InvalidCertificates, setInvalidCertificates] = React.useState<{ [index: number]: string }>({});
    const [NewVersionURL, setNewVersionURL] = React.useState<string>();
    const [IsLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        IPC.listenForImportedCertificate((event, args: Certificate[]) => {
            const certificate = args[0];
            setState(state => {
                const certificates = state.certificates;
                certificates[0] = {
                    KeyType: KeyType.ECDSA,
                    Subject: certificate.Subject,
                    Validity: {
                        NotBefore: Calendar.now(),
                        NotAfter: Calendar.addDays(365),
                    },
                    AlternateNames: [],
                    Usage: {},
                    IsCertificateAuthority: true,
                    Imported: true
                };
                state.certificates = certificates;
                state.importedRoot = certificate;
                state.certificateEditKey = Rand.ID();
                return { ...state };
            });
        });

        IPC.checkForUpdates().then(newURL => {
            setNewVersionURL(newURL);
        });
    }, []);

    React.useEffect(() => {
        validateCertificates();
    }, [State]);

    const didClickCertificate = (idx: number) => {
        setState(state => {
            state.selectedCertificateIdx = idx;
            state.certificateEditKey = Rand.ID();
            return { ...state };
        });
    };

    const validateCertificates = () => {
        setInvalidCertificates(invalidCertificates => {
            invalidCertificates = {};
            State.certificates.forEach((certificate, idx) => {
                if (certificate.Imported) {
                    return;
                }

                const invalidReason = Validator.CertificateRequest(certificate);
                if (!invalidReason) {
                    return;
                }

                invalidCertificates[idx] = invalidReason;
            });

            return { ...invalidCertificates };
        });
    };

    const didShowCertificateContextMenu = (idx: number) => {
        const certificate = State.certificates[idx];
        if (certificate.IsCertificateAuthority) {
            IPC.showCertificateContextMenu(true);
        } else {
            IPC.showCertificateContextMenu(false).then(action => {
                switch (action) {
                    case 'delete':
                        setState(state => {
                            let selectedCertificateIdx = state.selectedCertificateIdx;
                            if (idx <= state.selectedCertificateIdx) {
                                selectedCertificateIdx--;
                            }
                            state.certificates.splice(idx, 1);
                            state.selectedCertificateIdx = selectedCertificateIdx;
                            state.certificateEditKey = Rand.ID();
                            return { ...state };
                        });
                        break;
                    case 'duplicate':
                        setState(state => {
                            const copyCertificate = JSON.parse(JSON.stringify(certificate)) as CertificateRequest;
                            state.certificates.push(copyCertificate);
                            return { ...state };
                        });
                        break;
                }
            });
        }
    };

    const addButtonClick = () => {
        setState(state => {
            const newLength = state.certificates.push(blankRequest(false));
            state.selectedCertificateIdx = newLength - 1;
            state.certificateEditKey = Rand.ID();
            return { ...state };
        });
    };

    const didChangeCertificate = (certificate: CertificateRequest) => {
        setState(state => {
            state.certificates[state.selectedCertificateIdx] = certificate;
            return { ...state };
        });
    };

    const didCancelImport = () => {
        setState(state => {
            state.certificates[0] = blankRequest(true);
            state.certificateEditKey = Rand.ID();
            return { ...state };
        });
    };

    const generateCertificateClick = () => {
        setIsLoading(true);
        IPC.exportCertificates(State.certificates, State.importedRoot).then(() => {
            setIsLoading(false);
            console.info('Generated certificates');
        }, err => {
            setIsLoading(false);
            console.error(err);
        });
    };

    const addButtonDisabled = () => {
        return State.certificates.length > 128;
    };

    const newVersionBanner = () => {
        if (!NewVersionURL) {
            return null;
        }

        return (<div className="new-version">
            <strong>A newer version is available</strong>
            <Link url={NewVersionURL}>Click here to view</Link>
        </div>);
    };

    const buttonLabel = () => {
        if (IsLoading) {
            return (<Icon.Label icon={<Icon.Spinner pulse />} label="Exporting..." />);
        }

        return (<Icon.Label icon={<Icon.FileExport />} label="Generate Certificates" />);
    };

    return (<ErrorBoundary>
        <div id="main">
            <div className="certificate-list">
                {newVersionBanner()}
                <CertificateList certificates={State.certificates} selectedIdx={State.selectedCertificateIdx} onClick={didClickCertificate} onShowContextMenu={didShowCertificateContextMenu} invalidCertificates={InvalidCertificates} />
                <div className="certificate-list-footer">
                    <Button onClick={addButtonClick} disabled={addButtonDisabled()}>
                        <Icon.Label icon={<Icon.PlusCircle />} label="Add Certificate" />
                    </Button>
                </div>
            </div>
            <div className="certificate-view">
                <CertificateEdit defaultValue={State.certificates[State.selectedCertificateIdx]} onChange={didChangeCertificate} onCancelImport={didCancelImport} key={State.certificateEditKey} />
            </div>
            <footer>
                <Button onClick={generateCertificateClick} disabled={Object.keys(InvalidCertificates).length > 0 || IsLoading}>
                    {buttonLabel()}
                </Button>
            </footer>
        </div>
    </ErrorBoundary>);
};
