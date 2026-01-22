import fs from 'fs';
import path from 'path';
import { GetServerSideProps } from 'next';

export function withMessages(): GetServerSideProps {
    return async ({ locale }) => {
        const messages = JSON.parse(
            fs.readFileSync(
                path.join(process.cwd(), 'messages', `${locale}.json`),
                'utf-8'
            )
        );

        return {
            props: {
                locale,
                messages,
            },
        };
    };
}
