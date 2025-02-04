import { Spinner, StatusMessage } from "@inkjs/ui";
import { Text, render } from "ink";
import React from "react";

export const customersMessage = async <T,>(customersPromise: Promise<T>) => {
	const { unmount, clear, waitUntilExit } = render(
		<Spinner label="Importing customers... This may take a few minutes." />,
	);

	customersPromise.then(() => {
		clear();
		unmount();
	});

	await waitUntilExit();

	return customersPromise;
};

export const customersFailedMessage = async () => {
	const { unmount, waitUntilExit } = render(
		<StatusMessage variant="warning">
			<Text>Could not import customers</Text>
		</StatusMessage>,
	);

	setTimeout(() => {
		unmount();
	}, 1000);

	await waitUntilExit();
};
