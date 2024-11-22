import { Spinner, StatusMessage } from "@inkjs/ui";
import { Text, render } from "ink";
import React from "react";

export const uploadMessage = async <T,>(fileUploadPromise: Promise<T>) => {
	const { unmount, clear, waitUntilExit } = render(
		<Spinner label="Uploading file..." />,
	);

	fileUploadPromise.then(() => {
		clear();
		unmount();
	});

	await waitUntilExit();
};

export const uploadFailedMessage = async () => {
	const { unmount, waitUntilExit } = render(
		<StatusMessage variant="warning">
			<Text>Could not upload files associated with product</Text>
		</StatusMessage>,
	);

	setTimeout(() => {
		unmount();
	}, 1000);

	await waitUntilExit();
};
