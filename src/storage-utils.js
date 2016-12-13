export function getOrUpdateUser({controller, message}) {
  return new Promise((resolve, reject) => {
    controller.storage.users.get(message.user, (err, user) => {
      if (err) {
        reject(err.message);
        return;
      }

      if (!user) {
        const response = JSON.parse(message.payload);
        user = {
          id: message.user,
          user: response.user.name
        };

        controller.storage.users.save(user);
      }

      resolve(user);
    });
  });
}
