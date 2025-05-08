# Use the official PHP 8.1 image **with Apache**
FROM php:8.1-apache

# Update and install utilities (just in case)
RUN apt-get update && apt-get install -y \
    libzip-dev zip unzip

# Enable Apache mod_rewrite (for pretty URLs, optional)
RUN a2enmod rewrite

# Copy all app files into Apache's public root
COPY . /var/www/html/

# Set proper ownership/permissions
RUN chown -R www-data:www-data /var/www/html

# Expose port 80
EXPOSE 80

# Start Apache in the foreground (DO NOT override with "Start Command" in Render)
CMD ["apache2-foreground"]
