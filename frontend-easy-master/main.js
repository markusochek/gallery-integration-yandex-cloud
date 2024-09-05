document.addEventListener("DOMContentLoaded", function () {
  // Получаем ссылки на элементы кнопок
  const requestImagesButton = document.getElementById("requestImages");
  const addImageButton = document.getElementById("addImageInput");
  const gallery = document.getElementById("gallery");

  // Обработчик события для кнопки "Запросить все картинки"
  requestImagesButton.addEventListener("click", async function () {
      // Выполняем GET-запрос к серверу
      await fetch("http://localhost:3000/api/images")
          .then((response) => {
              if (!response.ok) throw new Error("Network response was not ok")
              return response.json();
          })
          .then((data) => {
              gallery.replaceChildren()
              // Добавляем полученные изображения к галерее
              data.forEach((image) => {
                  const galleryItem = document.createElement("div")
                  const div = document.createElement("div")
                  div.className = "overlay"
                  div.innerText = "55.0 kB"

                  let button = document.createElement("button")
                  button.innerText = "Развернуть"
                  button.className = "expand-button"
                  button.onclick = async () => {
                      await fetch(`http://localhost:3000/api/images/original/?filePath=${image.filePath}`)
                      .then(res => res.json())
                      .then(response => {
                          console.log(response.buffer.data)
                          document.body.innerHTML = `<img src=data:image/png;base64,${response.buffer} alt="load1"></img>`;
                          button = document.createElement("button")
                          button.innerText = "вернуться";
                          button.onclick = () => {
                              window.location.replace("http://localhost:3001");
                          }
                          document.body.appendChild(button);
                      })
                  }
                  div.appendChild(button)
                  galleryItem.appendChild(div)

                  button = document.createElement("button")
                  button.innerText = "Удалить"
                  button.className = "delete-button"
                  button.onclick = async () => {
                      await fetch(`http://localhost:3000/api/images/?filePath=${image.filePath}`, {
                          method: "DELETE"
                      })
                          .then(res => res.json())
                          .then(() => galleryItem.remove())
                  }
                  galleryItem.appendChild(button)

                  galleryItem.classList.add("gallery-item")
                  const img = document.createElement("img")
                  img.src = "data:image/png;base64," + image.buffer
                  img.alt = "image"
                  galleryItem.appendChild(img)

                  // Добавляем элемент галереи к контейнеру
                  gallery.appendChild(galleryItem);
              });
          })
          .catch((error) => {
              console.error(
                  "There has been a problem with your fetch operation:",
                  error
              );
          });
  });

  // Обработчик события для кнопки "Добавить картинку"
  addImageButton.addEventListener("change", async function (event) {
      const file = event.target.files[0];
      if (file) {
          // Создаем объект FormData и добавляем в него файл
          const formData = new FormData();
          formData.append("file", file);
          formData.append("createdAt", "2012-12-11");
          formData.append("name", "piskamangusta");
          formData.append("fileSize", 50);
          formData.append("height", 500);
          formData.append("width", 500);

          // Выполняем POST-запрос на загрузку файла
          await fetch("http://localhost:3000/api/images", {
              method: "POST",
              body: formData,
          })
              .then((response) => {
                  if (!response.ok) throw new Error("Network response was not ok")
                  return response.json();
              })
              .then((response) => {
                  console.log("File uploaded successfully:", response)
                  const galleryItem = document.createElement("div")
                  const div = document.createElement("div")
                  div.className = "overlay"
                  div.innerText = "55.0 kB"

                  let button = document.createElement("button")
                  button.innerText = "Развернуть"
                  button.className = "expand-button"
                  button.onclick = async () => {
                      await fetch(`http://localhost:3000/api/images/original/?filePath=${response.filePath}`)
                          .then(res => res.json())
                          .then(response => {
                              document.body.innerHTML = `<img src=data:image/png;base64,${response.buffer} alt="load1"></img>`;
                              button = document.createElement("button")
                              button.innerText = "вернуться";
                              button.onclick = () => {
                                  window.location.replace("http://localhost:3001");
                              }
                              document.body.appendChild(button);
                          })
                  }
                  div.appendChild(button)
                  galleryItem.appendChild(div)

                  button = document.createElement("button")
                  button.innerText = "Удалить"
                  button.className = "delete-button"
                  button.onclick = async () => {
                      await fetch(`http://localhost:3000/api/images/?filePath=${response.filePath}`, {
                          method: "DELETE"
                      })
                          .then(res => res.json())
                          .then(() => galleryItem.remove())
                  }
                  galleryItem.appendChild(button)

                  galleryItem.classList.add("gallery-item")
                  const img = document.createElement("img")
                  img.src = URL.createObjectURL(file)
                  img.alt = "image"
                  galleryItem.appendChild(img)

                  // Добавляем элемент галереи к контейнеру
                  gallery.appendChild(galleryItem);
              })
              .catch((error) => console.error("There has been a problem with your fetch operation:", error));
      }
  });
});
